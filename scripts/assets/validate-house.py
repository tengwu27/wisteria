#!/usr/bin/env python3
"""Validate the runtime main-house geometry contract and write its QA report."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "src/assets/images/world/house/v2"
CONTRACT = PACKAGE / "house-v2.json"
REPORT = PACKAGE / "validation-report.json"


def visible_bbox(path: Path) -> tuple[int, int, int, int] | None:
    return Image.open(path).convert("RGBA").getchannel("A").getbbox()


def main() -> int:
    data = json.loads(CONTRACT.read_text())
    canvas = (data["canvas"]["width"], data["canvas"]["height"])
    socket = data["sockets"]["mainDoor"]
    errors: list[str] = []
    checks: list[dict[str, object]] = []

    asset_names = [
        "house-shell-v2.png",
        "main-door-interior-v2.png",
        "main-door-closed-v2.png",
        "main-door-open-v2.png",
        "main-door-foreground-v2.png",
        socket["fitMask"],
        "window-backplates-v2.png",
        "windows-closed-v2.png",
        "windows-open-v2.png",
        "turbine-mast-v2.png",
        "turbine-rotor-v2.png",
        "turbine-hub-v2.png",
        "roof-flag-v2.png",
        "wall-lamp-off-v2.png",
        "wall-lamp-on-v2.png",
        "clock-base-v2.png",
    ]
    for name in asset_names:
        path = PACKAGE / name
        ok = path.exists()
        detail = "missing"
        if ok:
            image = Image.open(path)
            ok = image.size == canvas and image.mode == "RGBA"
            detail = f"{image.size[0]}x{image.size[1]} {image.mode}"
        if not ok:
            errors.append(f"{name}: expected {canvas[0]}x{canvas[1]} RGBA")
        checks.append({"name": f"format:{name}", "pass": ok, "detail": detail})

    states = socket["states"]
    facing_ok = all(state["facing"] == data["nativeFacing"] for state in states.values())
    pivot_ok = all(state["pivot"] == socket["pivot"] for state in states.values())
    if not facing_ok:
        errors.append("Door state facing does not match package nativeFacing")
    if not pivot_ok:
        errors.append("Door states do not share the socket pivot")
    checks.extend([
        {"name": "state-facing", "pass": facing_ok, "detail": data["nativeFacing"]},
        {"name": "shared-pivot", "pass": pivot_ok, "detail": socket["pivot"]},
    ])

    mask = Image.open(PACKAGE / socket["fitMask"]).convert("RGBA").getchannel("A")
    closed_alpha = Image.open(PACKAGE / states["closed"]["asset"]).convert("RGBA").getchannel("A")
    # One-pixel tolerance is represented by a 3x3 dilation on each side.
    mask_tolerance = mask.filter(ImageFilter.MaxFilter(3))
    closed_tolerance = closed_alpha.filter(ImageFilter.MaxFilter(3))
    spill = ImageChops.subtract(closed_alpha, mask_tolerance).getbbox()
    gap = ImageChops.subtract(mask, closed_tolerance).getbbox()
    fit_ok = spill is None and gap is None
    if not fit_ok:
        errors.append(f"Closed door fit failed: spill={spill}, gap={gap}")
    checks.append({"name": "closed-fit-mask", "pass": fit_ok, "detail": {"spill": spill, "gap": gap}})

    open_bbox = visible_bbox(PACKAGE / states["open"]["asset"])
    envelope = socket["motionEnvelope"]
    envelope_box = (envelope["x"], envelope["y"], envelope["x"] + envelope["w"], envelope["y"] + envelope["h"])
    envelope_ok = bool(open_bbox) and open_bbox[0] >= envelope_box[0] and open_bbox[1] >= envelope_box[1] and open_bbox[2] <= envelope_box[2] and open_bbox[3] <= envelope_box[3]
    if not envelope_ok:
        errors.append(f"Open door bbox {open_bbox} exceeds motion envelope {envelope_box}")
    checks.append({"name": "open-motion-envelope", "pass": envelope_ok, "detail": {"bbox": open_bbox, "envelope": envelope_box}})

    hinge_x = socket["pivot"]["x"]
    hinge_side = socket.get("hingeSideNative")
    inward_ok = bool(open_bbox) and socket.get("opens") == "inward" and (
        (hinge_side == "right" and open_bbox[2] <= hinge_x + 1)
        or (hinge_side == "left" and open_bbox[0] >= hinge_x - 1)
    )
    if not inward_ok:
        errors.append(f"Open door is not contained on the inward side of its {hinge_side} native hinge")
    checks.append({
        "name": "inward-hinge-side",
        "pass": inward_ok,
        "detail": {
            "opens": socket.get("opens"),
            "nativeHinge": hinge_side,
            "integratedHinge": socket.get("hingeSideIntegrated"),
            "pivotX": hinge_x,
            "openBBox": open_bbox,
        },
    })

    windows = data["sockets"]["windows"]
    lamp = data["sockets"]["wallLamp"]
    state_canvas_ok = all(
        Image.open(PACKAGE / state["asset"]).size == canvas
        for group in (windows, lamp)
        for state in group["states"].values()
    )
    if not state_canvas_ok:
        errors.append("Window or lamp authored states do not share the canonical canvas")
    checks.append({"name": "remaining-state-canvases", "pass": state_canvas_ok, "detail": canvas})

    expected_modes = {
        "mainDoor": "behind-aperture",
        "windows": "behind-aperture",
        "turbine": "sandwiched",
        "roofFlag": "foreground-mounted",
        "wallLamp": "foreground-mounted",
        "wallClock": "foreground-mounted",
    }
    modes_ok = all(data["sockets"][name].get("placementMode") == mode for name, mode in expected_modes.items())
    if not modes_ok:
        errors.append("One or more component depth modes are incorrect")
    checks.append({"name": "component-depth-modes", "pass": modes_ok, "detail": expected_modes})

    render_order = data.get("renderOrder", [])
    shell_index = render_order.index("house-shell-v2.png") if "house-shell-v2.png" in render_order else -1
    occlusion_ok = shell_index > render_order.index("windows-closed-v2.png|windows-open-v2.png") and shell_index > render_order.index("main-door-closed-v2.png|main-door-open-v2.png")
    if not occlusion_ok:
        errors.append("The house shell must render above windows and the inward door")
    checks.append({"name": "shell-occludes-aperture-components", "pass": occlusion_ok, "detail": render_order})

    turbine = data["sockets"]["turbine"]
    rigid_ok = turbine.get("animation") == "runtime-rotation" and turbine["layerOrder"] == [
        "turbine-mast-v2.png", "turbine-rotor-v2.png", "turbine-hub-v2.png"
    ]
    if not rigid_ok:
        errors.append("Turbine must use one runtime rotor sandwiched between mast and hub")
    checks.append({"name": "rigid-turbine-stack", "pass": rigid_ok, "detail": turbine})

    hinge_line = socket.get("hingeLine")
    projection = socket.get("openProjection")
    projection_ok = bool(hinge_line and projection) and (
        projection["hingeTop"]["x"] == projection["hingeBottom"]["x"] == hinge_line["top"]["x"] == hinge_line["bottom"]["x"]
        and projection["hingeTop"]["y"] <= hinge_line["top"]["y"]
        and projection["hingeBottom"]["y"] == hinge_line["bottom"]["y"]
        and projection["freeTop"]["y"] > projection["hingeTop"]["y"]
        and projection["freeBottom"]["y"] < projection["hingeBottom"]["y"]
        and (
            (hinge_side == "right" and projection["freeTop"]["x"] < projection["hingeTop"]["x"] and projection["freeBottom"]["x"] < projection["hingeBottom"]["x"])
            or (hinge_side == "left" and projection["freeTop"]["x"] > projection["hingeTop"]["x"] and projection["freeBottom"]["x"] > projection["hingeBottom"]["x"])
        )
    )
    if not projection_ok:
        errors.append("Open-door projection does not preserve the full hinge line or recede inward")
    checks.append({
        "name": "fixed-hinge-perspective",
        "pass": projection_ok,
        "detail": {"hingeLine": hinge_line, "openProjection": projection},
    })

    report = {
        "package": data["id"],
        "pass": not errors,
        "canvas": data["canvas"],
        "nativeFacing": data["nativeFacing"],
        "checks": checks,
        "errors": errors,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(report, indent=2) + "\n"
    REPORT.write_text(payload)
    print(json.dumps(report, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
