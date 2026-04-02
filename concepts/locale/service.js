const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Service for managing locale configuration and inlang project settings
 */
class LocaleService {
    /**
     * Get the current locale from various sources in priority order
     * @param {string} [projectRoot] Optional project root for project-specific baseLocale fallback
     * @returns {string} The current locale code
     */
    getCurrentLocale(projectRoot) {
        // 1. Check VS Code configuration
        const config = vscode.workspace.getConfiguration('elementaryWatson');
        const configLocale = config.get('defaultLocale');
        if (configLocale) {
            return configLocale;
        }

        // 2. Check inlang settings using project root or workspace root fallback
        const rootPath = projectRoot || (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
        if (rootPath) {
            const inlangSettings = this.loadInlangSettings(rootPath);
            if (inlangSettings && inlangSettings.baseLocale) {
                return inlangSettings.baseLocale;
            }
        }

        // 3. Default to English
        return 'en';
    }

    /**
     * Load inlang project settings
     * @param {string} workspacePath 
     * @returns {Object|null} The inlang settings or null if not found
     */
    loadInlangSettings(workspacePath) {
        try {
            const inlangSettingsPath = path.join(workspacePath, 'project.inlang', 'settings.json');
            
            if (!fs.existsSync(inlangSettingsPath)) {
                console.log(`📝 No inlang settings found at: ${inlangSettingsPath}`);
                return null;
            }

            const fileContent = fs.readFileSync(inlangSettingsPath, 'utf8');
            const settings = JSON.parse(fileContent);
            
            console.log(`📖 Loaded inlang settings from: ${path.basename(inlangSettingsPath)}`);
            
            return settings;
        } catch (error) {
            console.log(`❌ Failed to load inlang settings: ${error.message}`);
            return null;
        }
    }

    /**
     * Get the path pattern for translation files
     * @param {string} workspacePath 
     * @returns {string} The path pattern for translation files
     */
    getTranslationPathPattern(workspacePath) {
        const inlangSettings = this.loadInlangSettings(workspacePath);
        
        if (inlangSettings && 
            inlangSettings['plugin.inlang.messageFormat'] && 
            inlangSettings['plugin.inlang.messageFormat'].pathPattern) {
            return inlangSettings['plugin.inlang.messageFormat'].pathPattern;
        }
        
        // Fallback to default pattern
        return './messages/{locale}.json';
    }

    /**
     * Resolve the actual translation file path
     * @param {string} workspacePath 
     * @param {string} locale 
     * @returns {string} The resolved path to the translation file
     */
    resolveTranslationPath(workspacePath, locale) {
        const pathPattern = this.getTranslationPathPattern(workspacePath);
        
        // Replace {locale} placeholder with actual locale
        const relativePath = pathPattern.replace('{locale}', locale);
        
        // Resolve relative path from workspace root
        let resolvedPath;
        if (relativePath.startsWith('./')) {
            resolvedPath = path.join(workspacePath, relativePath.substring(2));
        } else if (relativePath.startsWith('/')) {
            resolvedPath = path.join(workspacePath, relativePath.substring(1));
        } else {
            resolvedPath = path.join(workspacePath, relativePath);
        }
        
        console.log(`🔍 Resolved translation path for locale '${locale}': ${resolvedPath}`);
        
        return resolvedPath;
    }

    /**
     * Update the current locale in VS Code configuration
     * @param {string} locale The new locale to set
     * @returns {Promise<void>}
     */
    async updateLocale(locale) {
        const config = vscode.workspace.getConfiguration('elementaryWatson');
        await config.update('defaultLocale', locale, vscode.ConfigurationTarget.Workspace);
    }
}

module.exports = { LocaleService }; 