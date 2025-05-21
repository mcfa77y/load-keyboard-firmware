# Keyboard Firmware Loader

A command-line tool to simplify the process of loading firmware onto split mechanical keyboards.

## Features

- Automatically finds and lists firmware ZIP files from your Downloads folder
- Extracts left and right keyboard firmware files
- Guides you through the process of putting each keyboard half into bootloader mode
- Handles the file copying with retry logic for reliability
- User-friendly colored console output

## Installation

```bash
# Clone the repository
git clone https://github.com/mcfa77y/load-keyboard-firmware.git

# Navigate to the project directory
cd load-keyboard-firmware

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## Usage

```bash
# Run the tool
pnpm start
```

The tool will:
1. List available firmware ZIP files from your Downloads folder
2. Let you select which firmware to use
3. Guide you through putting each keyboard half into bootloader mode
4. Copy the firmware files to each keyboard half

## Requirements

- Node.js 16+
- A split mechanical keyboard with Nice!Nano controllers (or compatible)
- Firmware files in a ZIP archive with files matching the patterns:
  - `sofle_left*.uf2` for the left half
  - `sofle_right*.uf2` for the right half

## Configuration

The tool is currently configured for Sofle keyboards with Nice!Nano controllers. You can modify the following constants in `src/index.ts` if needed:

- `DOWNLOADS_FOLDER`: The folder where your firmware ZIP files are located
- `NICENANO_VOLUME`: The mount point for your keyboard in bootloader mode
- `LEFT_FIRMWARE_PATTERN`: Regex pattern to identify left keyboard firmware
- `RIGHT_FIRMWARE_PATTERN`: Regex pattern to identify right keyboard firmware

## License

ISC

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
