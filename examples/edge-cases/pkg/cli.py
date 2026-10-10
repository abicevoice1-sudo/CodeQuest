from .helpers import build_greeting
from . import core


def run():
    return build_greeting(core.VERSION)


if __name__ == "__main__":
    print(run())
