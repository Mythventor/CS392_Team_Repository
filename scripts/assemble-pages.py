"""Assemble both introductions, the project index, and the legacy redirect."""
import argparse
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    output = parser.parse_args().output.resolve()
    here = ROOT / 'sites/here/dist'
    if not (here / 'index.html').is_file():
        parser.error('Build sites/here with npm run build before assembling Pages.')
    # All inputs must exist before writing the deployment artifact.
    public_files = ['index.html', 'styles.css', 'script.js', 'favicon.svg']
    for name in public_files:
        if not (ROOT / 'sites/passdown' / name).is_file():
            parser.error(f'Missing Passdown public file: {name}')
    output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / 'sites/index.html', output / 'index.html')
    shutil.copytree(here, output / 'Here_Ad', dirs_exist_ok=True)
    passdown = output / 'Passdown_Ad'
    passdown.mkdir(exist_ok=True)
    for name in public_files:
        shutil.copy2(ROOT / 'sites/passdown' / name, passdown / name)
    legacy = output / 'QRise_Ad'
    legacy.mkdir(exist_ok=True)
    (legacy / 'index.html').write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=../Here_Ad/">
<link rel="canonical" href="https://mythventor.github.io/CS392_Team_Repository/Here_Ad/">
<title>QRise is now Here!</title></head>
<body><p>QRise is now Here!, a class attendance app. <a href="../Here_Ad/">Visit the Here! introduction</a>.</p></body></html>
''', encoding='utf-8')
    (output / '.nojekyll').touch()
    print(f'Assembled Here_Ad/, Passdown_Ad/, QRise_Ad/ redirect, and index at {output}')


if __name__ == '__main__':
    main()
