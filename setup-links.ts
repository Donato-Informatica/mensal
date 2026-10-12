import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Creates a symbolic link or directory junction between two paths.
 *
 * @param target - The relative path to the target directory.
 * @param link - The relative path where the link should be created.
 */
function setupLinks(target: string, link: string): void {
    const targetPath = resolve(import.meta.dirname, target, "skills");
    const linkPath = resolve(import.meta.dirname, link, "skills");
    if (!existsSync(targetPath)) {
        console.warn(`⚠️ Target folder ${target} does not exist yet. Skipping link creation.`);
        return;
    }
    if (!existsSync(linkPath)) {
        try {
            mkdirSync(dirname(linkPath), { recursive: true });
            symlinkSync(targetPath, linkPath, "junction");
            console.log(`✅ Successfully created link: ${link} -> ${target}`);
        } catch (error) {
            console.error("❌ Failed to create link:", error instanceof Error ? error.message : error);
        }
    } else {
        console.log(`ℹ️ The ${link} link already exists. Nothing to do.`);
    }
}

setupLinks(".agents", ".agent");
setupLinks(".agents", ".claude");
