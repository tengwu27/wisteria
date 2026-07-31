import argparse

from PIL import Image, ImageOps


def parse_args():
    parser = argparse.ArgumentParser(
        description="Replace chroma spill in a transparent cloud plate."
    )
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    return parser.parse_args()


def main():
    args = parse_args()
    source = Image.open(args.input).convert("RGBA")
    alpha = source.getchannel("A")
    luminance = ImageOps.grayscale(source.convert("RGB"))
    toned = ImageOps.colorize(
        luminance,
        black=(116, 137, 171),
        white=(255, 250, 236),
    ).convert("RGBA")
    toned.putalpha(alpha)
    if args.width and args.height:
        toned = toned.resize(
            (args.width, args.height),
            Image.Resampling.LANCZOS,
        )
    elif args.width or args.height:
        raise SystemExit("--width and --height must be provided together")
    toned.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
