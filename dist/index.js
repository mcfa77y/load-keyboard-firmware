#!/usr/bin/env node
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import inquirer from 'inquirer';
import extract from 'extract-zip';
import chalk from 'chalk';
// Constants
const DOWNLOADS_FOLDER = path.join(os.homedir(), 'Downloads', 'Personal');
console.log(DOWNLOADS_FOLDER);
const NICENANO_VOLUME = '/Volumes/NICENANO';
const LEFT_FIRMWARE_PATTERN = /sofle_left.*\.uf2$/i;
const RIGHT_FIRMWARE_PATTERN = /sofle_right.*\.uf2$/i;
/**
 * Get zip files from downloads folder sorted by modification time (newest first)
 */
// Format relative time (e.g., '2 hours ago', '5 minutes ago')
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay > 0) {
        return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    }
    else if (diffHour > 0) {
        return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    }
    else if (diffMin > 0) {
        return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    }
    else {
        return 'just now';
    }
}
async function getZipFiles() {
    try {
        const files = await fs.readdir(DOWNLOADS_FOLDER);
        const zipFiles = files.filter((file) => file.endsWith('.zip'));
        // Get file stats for each zip file
        const fileStats = await Promise.all(zipFiles.map(async (file) => {
            const filePath = path.join(DOWNLOADS_FOLDER, file);
            const stats = await fs.stat(filePath);
            return {
                name: file,
                path: filePath,
                mtime: stats.mtime,
                relativeTime: formatRelativeTime(stats.mtime)
            };
        }));
        // Sort by modification time (newest first)
        fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        return fileStats;
    }
    catch (error) {
        console.error('Error reading downloads folder:', error);
        return [];
    }
}
/**
 * Extract firmware files from the zip file
 */
async function extractFirmwareFiles(zipFilePath) {
    const tempDir = path.join(os.tmpdir(), `keyboard-firmware-${Date.now()}`);
    await fs.ensureDir(tempDir);
    try {
        // Extract the zip file
        await extract(zipFilePath, { dir: tempDir });
        // Find firmware files
        const files = await fs.readdir(tempDir);
        const leftFirmware = files.find((file) => LEFT_FIRMWARE_PATTERN.test(file));
        const rightFirmware = files.find((file) => RIGHT_FIRMWARE_PATTERN.test(file));
        if (!leftFirmware || !rightFirmware) {
            throw new Error('Could not find both left and right firmware files in the zip');
        }
        return {
            leftFirmware: path.join(tempDir, leftFirmware),
            rightFirmware: path.join(tempDir, rightFirmware)
        };
    }
    catch (error) {
        await fs.remove(tempDir);
        throw error;
    }
}
/**
 * Check if the NICENANO volume is fully mounted and ready
 */
async function isVolumeReady() {
    try {
        // Check if the volume exists
        await fs.access(NICENANO_VOLUME);
        // Try to list files to ensure the volume is mounted and accessible
        await fs.readdir(NICENANO_VOLUME);
        // Check if the volume is writable
        await fs.access(NICENANO_VOLUME, fs.constants.W_OK);
        return true;
    }
    catch (error) {
        return false;
    }
}
/**
 * Wait for the keyboard to be in bootloader mode
 */
async function waitForBootloaderMode(side) {
    console.log(chalk.yellow(`Waiting for ${side} keyboard to be in bootloader mode...`));
    console.log(chalk.blue(`Please put the ${side} keyboard in bootloader mode by pressing and holding the reset button while plugging in the USB cable.`));
    // Keep checking for the NICENANO volume
    while (true) {
        if (await isVolumeReady()) {
            console.log(chalk.green(`${side.toUpperCase()} keyboard detected in bootloader mode!`));
            // Add a small delay to ensure the volume is fully ready
            await new Promise(resolve => setTimeout(resolve, 1500));
            return;
        }
        // Volume not found or not ready, wait and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}
/**
 * Copy firmware file to the keyboard with retry logic
 */
async function copyFirmwareToKeyboard(firmwarePath, side) {
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second
    let retries = 0;
    while (retries < maxRetries) {
        try {
            console.log(chalk.yellow(`Copying ${side} firmware to keyboard...`));
            // Make sure the volume is ready before copying
            console.log(chalk.blue('Ensuring the keyboard is ready for writing...'));
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Verify the volume exists and is writable
            await fs.access(NICENANO_VOLUME, fs.constants.W_OK);
            // Copy the firmware file
            await fs.copy(firmwarePath, path.join(NICENANO_VOLUME, path.basename(firmwarePath)));
            console.log(chalk.green(`${side.toUpperCase()} firmware copied successfully!`));
            // Wait for the keyboard to restart
            console.log(chalk.blue('Waiting for keyboard to restart...'));
            await new Promise(resolve => setTimeout(resolve, 2000));
            return;
        }
        catch (error) {
            retries++;
            if (retries >= maxRetries) {
                console.error(chalk.red(`Error copying ${side} firmware after ${maxRetries} attempts:`), error);
                throw error;
            }
            else {
                console.warn(chalk.yellow(`Error copying ${side} firmware (attempt ${retries}/${maxRetries}). Retrying in ${retryDelay / 1000} seconds...`));
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
}
/**
 * Main function
 */
async function main() {
    try {
        console.log(chalk.bold('Keyboard Firmware Loader'));
        console.log(chalk.gray('This script will help you load firmware to your split keyboard.'));
        // Get zip files from downloads folder
        const zipFiles = await getZipFiles();
        if (zipFiles.length === 0) {
            console.error('No zip files found in downloads folder.');
            process.exit(1);
        }
        // Prompt user to select a zip file
        const { zipFile } = await inquirer.prompt([
            {
                type: 'list',
                name: 'zipFile',
                message: 'Select the firmware zip file:',
                choices: zipFiles.map(file => ({
                    name: `${path.basename(file.path)} (${file.relativeTime})`,
                    value: file.path
                }))
            }
        ]);
        // Extract firmware files
        console.log(chalk.yellow('Extracting firmware files...'));
        const { leftFirmware, rightFirmware } = await extractFirmwareFiles(zipFile);
        console.log(chalk.green('Firmware files extracted successfully!'));
        console.log(`Left firmware: ${path.basename(leftFirmware)}`);
        console.log(`Right firmware: ${path.basename(rightFirmware)}`);
        // Process left keyboard
        await waitForBootloaderMode('left');
        await copyFirmwareToKeyboard(leftFirmware, 'left');
        // Process right keyboard
        await waitForBootloaderMode('right');
        await copyFirmwareToKeyboard(rightFirmware, 'right');
        console.log(chalk.green.bold('Firmware loading completed successfully!'));
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
// Run the main function
main();
