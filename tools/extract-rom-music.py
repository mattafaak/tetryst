#!/usr/bin/env python3
"""
Dump potential music data from NES/GB Tetris ROMs.
Usage:
  python3 tools/extract-rom-music.py nes  ~/Downloads/"Tetris (USA).nes"
  python3 tools/extract-rom-music.py gb   ~/Downloads/"Tetris (World) (Rev 1).gb"

NES APU note periods → Hz: freq = 1789773 / (16 * (period + 1))
"""
import sys
import struct

# NES equal-temperament note periods (APU timer values)
NES_NOTE_PERIODS: dict[str, int] = {
    "C4":  426, "Cs4": 402, "D4":  379, "Ds4": 358, "E4":  338,
    "F4":  319, "Fs4": 301, "G4":  284, "Gs4": 268, "A4":  253,
    "As4": 239, "B4":  225,
    "C5":  212, "Cs5": 200, "D5":  189, "Ds5": 178, "E5":  168,
    "F5":  159, "Fs5": 150, "G5":  141, "Gs5": 133, "A5":  126,
    "As5": 119, "B5":  112,
    "C6":  106, "Cs6": 100, "D6":   94, "Ds6":  89, "E6":   84,
    "F6":   79, "Fs6":  74, "G6":   70, "Gs6":  66, "A6":   63,
}


def period_to_freq(period: int) -> float:
    return 1789773.0 / (16.0 * (period + 1))


def dump_nes(path: str) -> None:
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"NES\x1a":
        print("Warning: iNES header not found — may not be a valid NES ROM")
    prg_banks = data[4]
    prg_size = prg_banks * 16384
    prg = data[16: 16 + prg_size]
    print(f"PRG-ROM: {len(prg)} bytes ({prg_banks} bank{'s' if prg_banks != 1 else ''})")
    print()

    # Search for note period byte sequences
    print("Note period occurrences in PRG-ROM:")
    print(f"  {'Note':<6} {'Period':>6}  {'Freq Hz':>8}  {'Count':>6}")
    print(f"  {'-'*6}  {'-'*6}  {'-'*8}  {'-'*6}")
    for name, period in sorted(NES_NOTE_PERIODS.items(), key=lambda x: x[1], reverse=True):
        lo = period & 0xFF
        # Count single-byte matches (period low byte) as a broad proxy
        count = prg.count(bytes([lo]))
        freq = period_to_freq(period)
        print(f"  {name:<6} {period:>6}  {freq:>8.2f}  {count:>6}")

    print()

    # Scan for recognisable Korobeiniki note sequences (Type A)
    # E5-B4-C5-D5 = periods 168, 225, 212, 189
    korobeiniki_seq = bytes([168, 225, 212, 189])
    positions = []
    for i in range(len(prg) - len(korobeiniki_seq)):
        if prg[i:i + len(korobeiniki_seq)] == korobeiniki_seq:
            positions.append(i)
    if positions:
        print(f"Possible Korobeiniki sequences (E5-B4-C5-D5) at PRG offsets: {[hex(p) for p in positions]}")
    else:
        print("No exact Korobeiniki byte sequence found (music likely uses lookup tables or indirect addressing)")

    print()

    # Dump the last PRG bank — NES music data is usually near the end
    last_bank_start = len(prg) - 16384
    print(f"Last PRG bank (offset 0x{last_bank_start:04x}–0x{len(prg) - 1:04x}), first 256 bytes:")
    for i in range(0, 256, 16):
        offset = last_bank_start + i
        row = prg[offset:offset + 16]
        hex_str = " ".join(f"{b:02x}" for b in row)
        print(f"  {0x8000 + i:04x}: {hex_str}")


def dump_gb(path: str) -> None:
    with open(path, "rb") as f:
        data = f.read()
    print(f"GB ROM: {len(data)} bytes")
    print()

    # GB music data confirmed at 0x5000–0x5200
    region_start = 0x5000
    region_end = min(0x5400, len(data))
    region = data[region_start:region_end]
    print(f"GB ROM region 0x{region_start:04x}–0x{region_end:04x} ({len(region)} bytes):")
    print()
    for i in range(0, len(region), 16):
        offset = region_start + i
        row = region[i:i + 16]
        hex_str = " ".join(f"{b:02x}" for b in row)
        # Annotate non-zero bytes
        ascii_str = "".join(chr(b) if 32 <= b < 127 else "." for b in row)
        print(f"  {offset:04x}: {hex_str}  |{ascii_str}|")

    print()

    # GB APU: square channel frequency = 131072 / (2048 - x) Hz
    # Common note values for GB Tetris
    GB_NOTES: dict[str, int] = {
        "A4": 1760, "B4": 1776, "C5": 1782, "D5": 1790,
        "E5": 1797, "F5": 1801, "G5": 1807, "A5": 1812,
    }
    print("GB APU note timer values in region:")
    for name, timer in GB_NOTES.items():
        lo = timer & 0xFF
        hi = (timer >> 8) & 0x07
        # Look for the high byte (bits 2-0) followed or preceded by low byte
        count = sum(1 for i in range(len(region) - 1)
                    if region[i] == lo and (region[i + 1] & 0x07) == hi)
        freq = 131072.0 / (2048 - timer)
        print(f"  {name:<4} timer={timer:4d}  freq={freq:7.2f} Hz  lo={lo:02x} hi={hi:02x}  pairs={count}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    mode, rom_path = sys.argv[1], sys.argv[2]
    if mode == "nes":
        dump_nes(rom_path)
    elif mode == "gb":
        dump_gb(rom_path)
    else:
        print(f"Unknown mode '{mode}'. Use 'nes' or 'gb'.")
        sys.exit(1)
