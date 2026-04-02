const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Registry for discovering and caching paraglide/inlang project roots in monorepos.
 * Provides two discovery strategies:
 * - Walk-up: find nearest project.inlang/ ancestor for a given file (hot path)
 * - Glob scan: discover all projects at activation for file watcher setup
 */
class ProjectRegistry {
    constructor() {
        /** @type {Map<string, string|null>} dirPath -> projectRoot or null */
        this.cache = new Map();
        /** @type {string[]} All known project root paths */
        this.knownProjects = [];
    }

    /**
     * Find the nearest project root containing project.inlang/settings.json
     * by walking up from filePath. Stops at workspace folder boundary.
     * Results are cached (including intermediate directories).
     * @param {string} filePath Absolute path to a file
     * @returns {string|null} The project root path, or null if not found
     */
    findProjectRoot(filePath) {
        let dir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
        dir = path.normalize(dir);

        // Check cache
        if (this.cache.has(dir)) {
            return this.cache.get(dir);
        }

        // Determine workspace folder boundary
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
        const boundary = workspaceFolder ? path.normalize(workspaceFolder.uri.fsPath) : null;

        // Walk up collecting directories to cache
        const visited = [];
        let current = dir;

        while (true) {
            // Check cache for this level
            if (this.cache.has(current)) {
                const result = this.cache.get(current);
                // Cache all visited directories with the same result
                for (const d of visited) {
                    this.cache.set(d, result);
                }
                return result;
            }

            visited.push(current);

            // Check if project.inlang/settings.json exists here
            const settingsPath = path.join(current, 'project.inlang', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                // Found it — cache all visited directories pointing to this root
                for (const d of visited) {
                    this.cache.set(d, current);
                }
                return current;
            }

            // Stop at workspace folder boundary
            if (boundary && current === boundary) {
                break;
            }

            // Move up one level
            const parent = path.dirname(current);
            if (parent === current) {
                // Reached filesystem root
                break;
            }
            current = parent;
        }

        // Not found — cache null for all visited directories
        for (const d of visited) {
            this.cache.set(d, null);
        }
        return null;
    }

    /**
     * Discover all project.inlang/settings.json files across workspace folders.
     * Populates knownProjects with their parent directories.
     * @param {readonly vscode.WorkspaceFolder[]} [workspaceFolders]
     * @returns {Promise<string[]>} Array of project root paths
     */
    async discoverProjects(workspaceFolders) {
        this.knownProjects = [];

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return this.knownProjects;
        }

        try {
            const files = await vscode.workspace.findFiles(
                '**/project.inlang/settings.json',
                '**/node_modules/**'
            );

            for (const uri of files) {
                // project root is two levels up from settings.json (parent of project.inlang/)
                const projectRoot = path.dirname(path.dirname(uri.fsPath));
                if (!this.knownProjects.includes(projectRoot)) {
                    this.knownProjects.push(projectRoot);
                }
            }

            console.log(`📂 Discovered ${this.knownProjects.length} inlang project(s): ${this.knownProjects.map(p => path.basename(p)).join(', ')}`);
        } catch (error) {
            console.error('Error discovering projects:', error);
        }

        return this.knownProjects;
    }

    /**
     * Clear all caches. Call when project.inlang/settings.json files change
     * or workspace folders change.
     */
    invalidate() {
        this.cache.clear();
    }

    /**
     * @returns {string[]} All known project root paths from last discoverProjects call
     */
    getKnownProjects() {
        return this.knownProjects;
    }
}

module.exports = { ProjectRegistry };
