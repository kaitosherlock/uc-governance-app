"""Parse UC names without guessing across quoted identifier boundaries."""
from urllib.parse import quote

from app.errors import ValidationFailed


def parts(name: str) -> tuple[str, ...]:
    result: list[str] = []
    segment = ""
    quoted = False
    closed = False
    i = 0
    while i < len(name):
        char = name[i]
        if char == '`':
            if quoted and i + 1 < len(name) and name[i + 1] == '`':
                segment += '`'
                i += 2
                continue
            if not quoted and (segment or closed):
                raise ValidationFailed("Invalid qualified object name.")
            quoted = not quoted
            closed = not quoted
        elif char == '.' and not quoted:
            if not segment:
                raise ValidationFailed("Invalid qualified object name.")
            result.append(segment)
            segment = ""
            closed = False
        elif closed or ord(char) < 32 or (not quoted and char.isspace()):
            raise ValidationFailed("Invalid qualified object name.")
        else:
            segment += char
        i += 1
    if quoted or not segment:
        raise ValidationFailed("Invalid qualified object name.")
    return (*result, segment)


def access_route(name: str) -> str:
    return '/assets/' + '/'.join(quote(p, safe='') for p in parts(name)) + '?tab=access'


def target_parts(securable_type: str, name: str) -> tuple[str, ...]:
    value = parts(name)
    expected = {'CATALOG': 1, 'SCHEMA': 2, 'TABLE': 3, 'VOLUME': 3,
                'FUNCTION': 3, 'REGISTERED_MODEL': 3}.get(securable_type, 1)
    if len(value) != expected:
        raise ValidationFailed("The qualified name does not match the securable type.")
    return value
