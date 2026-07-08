const fs = require('fs');
const path = require('path');

// Load the compiled emscripten module
const Module = require('../forml-compiler/wasm/forml.js');

Module.onRuntimeInitialized = function() {
    const fixturesDir = path.join(__dirname, '../forml-compiler/tests/fixtures');
    const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.forml')).sort();
    
    console.log(`Found ${files.length} test files. Running compilation...\n`);
    
    const results = [];

    for (const file of files) {
        const filePath = path.join(fixturesDir, file);
        const source = fs.readFileSync(filePath, 'utf8');
        
        console.log(`=========================================`);
        console.log(`Compiling: ${file}`);
        console.log(`=========================================`);
        
        try {
            const compileFn = Module.compileForml || Module.compile_forml;
            if (!compileFn) {
                console.error("Error: compileForml function not found in Module.");
                process.exit(1);
            }
            
            const jsonStr = compileFn(source);
            const result = JSON.parse(jsonStr);
            
            const hasErrors = result.diagnostics.some(d => d.severity === 'error');
            const hasWarnings = result.diagnostics.some(d => d.severity === 'warning');
            
            console.log(`Status: ${hasErrors ? 'ERRORS FOUND' : 'SUCCESS (CLEAN OR WARNINGS ONLY)'}`);
            console.log(`Diagnostics count: ${result.diagnostics.length}`);
            
            if (result.diagnostics.length > 0) {
                console.log("Diagnostics:");
                result.diagnostics.forEach(d => {
                    console.log(`  [${d.severity.toUpperCase()}] Line ${d.line}, Col ${d.col}: ${d.message}`);
                });
            }
            
            if (result.ast) {
                console.log("AST generated successfully.");
            } else {
                console.log("AST: null");
            }
            
            results.push({
                file,
                success: true,
                hasErrors,
                diagnostics: result.diagnostics,
                hasAst: !!result.ast,
                ast: result.ast
            });
            
        } catch (e) {
            console.error(`Crash or failure on file ${file}:`, e);
            results.push({
                file,
                success: false,
                error: e.message
            });
        }
        console.log();
    }
    
    console.log("Summary of results:");
    const summary = results.map(r => ({
        File: r.file,
        CompiledWithoutCrash: r.success ? "YES" : "NO (CRASHED)",
        HasErrors: r.success ? (r.hasErrors ? "YES" : "NO") : "N/A",
        DiagnosticsCount: r.success ? r.diagnostics.length : "N/A",
        ASTGenerated: r.success ? (r.hasAst ? "YES" : "NO") : "N/A"
    }));
    console.table(summary);
};
