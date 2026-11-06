"""Isolated X11 XTest keyboard shortcut helper for genuine Chromium zoom QA.

Adapted from GoreeCloud/gc-ui scripts/qa-x11-zoom.py, Apache-2.0.
Use ONLY under xvfb-run with GC_MAPS_ISOLATED_DISPLAY=1; never on a user's DISPLAY.
"""
import ctypes
import os
import sys
import time

if os.environ.get("GC_MAPS_ISOLATED_DISPLAY") != "1":
    raise SystemExit("Refusing X11 injection outside explicit isolated Maps QA")
if not os.environ.get("DISPLAY"):
    raise SystemExit("Missing isolated X11 display")
if len(sys.argv) != 3 or sys.argv[2] not in ("plus", "reset"):
    raise SystemExit("Usage: qa-x11-zoom.py 0xWINDOW plus|reset")

x11 = ctypes.CDLL("libX11.so.6")
xtst = ctypes.CDLL("libXtst.so.6")
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XRaiseWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_uint
x11.XFlush.argtypes = [ctypes.c_void_p]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]

display = x11.XOpenDisplay(None)
if not display:
    raise SystemExit("Could not connect to isolated X11 display")
try:
    window = int(sys.argv[1], 0)
    x11.XRaiseWindow(display, window)
    x11.XSetInputFocus(display, window, 1, 0)
    x11.XFlush(display)
    time.sleep(0.05)

    def key(name, down):
        keysym = x11.XStringToKeysym(name.encode("utf-8"))
        code = x11.XKeysymToKeycode(display, keysym)
        if not code:
            raise RuntimeError("No X11 keycode for " + name)
        xtst.XTestFakeKeyEvent(display, code, int(down), 0)

    pressed = ["Control_L", "equal"] if sys.argv[2] == "plus" else ["Control_L", "0"]
    for item in pressed:
        key(item, True)
    for item in reversed(pressed):
        key(item, False)
    x11.XFlush(display)
    time.sleep(0.07)
finally:
    x11.XCloseDisplay(display)
