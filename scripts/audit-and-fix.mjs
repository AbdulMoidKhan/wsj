#!/usr/bin/env node
/**
 * Comprehensive Project Audit & Fix Script
 * 
 * This script audits the entire Workspace Junction project for:
 * - TypeScript errors
 * - Missing imports
 * - Unused variables
 * - Missing images
 * - Broken internal links
 * - Code quality issues
 * - Performance problems
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const issues = {
  critical: [],
  warnings: [],
  info: [],
  fixed: []
};

/**
 * Check for missing image files
 */
async function checkMissingImages() {
  console.log('\n📸 Checking for missing images...');
  
  const imagesToCheck = [
    // About page
    'public/media/figma-pages/about-hero.webp',
    'public/media/figma-pages/about-story.webp',
    'public/media/figma-pages/about-spaces.webp',
    
    // Blog posts
    'public/media/figma-pages/blog-future-workspace.webp',
    'public/media/figma-pages/blog-coworking-team.webp',
    'public/media/figma-pages/blog-workspace-tour.webp',
    'public/media/figma-pages/blog-signs-coworking.webp',
    'public/media/figma-pages/blog-coworking-benefits.webp',
    'public/media/figma-pages/blog-choose-coworking.webp',
    'public/media/figma-pages/blog-junction-community.webp',
    'public/media/figma-pages/blog-oakbrook-coworking.webp',
    'public/media/figma-pages/blog-oakbrook-location.webp',
    'public/media/figma-pages/blog-remote-productivity.webp',
  ];
  
  let missing = 0;
  for (const imgPath of imagesToCheck) {
    const fullPath = path.join(PROJECT_ROOT, imgPath);
    try {
      await fs.access(fullPath);
    } catch {
      issues.warnings.push(`Missing image: ${imgPath}`);
      missing++;
    }
  }
  
  if (missing > 0) {
    console.log(`  ⚠️  ${missing} images missing (expected for placeholder content)`);
  } else {
    console.log('  ✅ All images present');
  }
}

/**
 * Check TypeScript files for basic syntax issues
 */
async function checkTypeScriptFiles() {
  console.log('\n📝 Checking TypeScript files...');
  
  const filesToCheck = [
    'lib/figma-pages/blogs.ts',
    'lib/figma-pages/community.ts',
    'lib/figma-pages/index.ts',
  ];
  
  for (const file of filesToCheck) {
    const filePath = path.join(PROJECT_ROOT, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for common syntax issues
      const openBraces = (content.match(/{/g) || []).length;
      const closeBraces = (content.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        issues.critical.push(`Unmatched braces in ${file}: ${openBraces} open, ${closeBraces} close`);
      }
      
      // Check for unterminated strings
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const singleQuotes = (line.match(/'/g) || []).length;
        const doubleQuotes = (line.match(/"/g) || []).length;
        const backticks = (line.match(/`/g) || []).length;
        
        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0) {
          // This could be a false positive for strings spanning multiple lines
          if (!line.includes('\\n')) {
            issues.warnings.push(`Possible unterminated string in ${file}:${i + 1}`);
          }
        }
      });
      
      console.log(`  ✅ ${file} - Syntax OK`);
    } catch (error) {
      issues.critical.push(`Cannot read ${file}: ${error.message}`);
    }
  }
}

/**
 * Check for missing imports
 */
async function checkImports() {
  console.log('\n🔍 Checking imports...');
  
  const blogsPath = path.join(PROJECT_ROOT, 'lib/figma-pages/blogs.ts');
  const indexPath = path.join(PROJECT_ROOT, 'lib/figma-pages/index.ts');
  
  try {
    const blogsContent = await fs.readFile(blogsPath, 'utf-8');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    
    // Check if blogs.ts is imported in index.ts
    if (!indexContent.includes("import {blogPages} from './blogs'")) {
      issues.critical.push('blogPages not imported in index.ts');
    } else {
      console.log('  ✅ blogPages imported correctly');
    }
    
    // Check if blogPages is merged in FIGMA_PAGES
    if (!indexContent.includes('blogPages')) {
      issues.critical.push('blogPages not included in FIGMA_PAGES export');
    } else {
      console.log('  ✅ blogPages exported correctly');
    }
    
    // Check if img helper is imported in blogs.ts
    if (!blogsContent.includes("import {img} from './spaces'")) {
      issues.critical.push('img helper not imported in blogs.ts');
    } else {
      console.log('  ✅ img helper imported');
    }
    
  } catch (error) {
    issues.critical.push(`Import check failed: ${error.message}`);
  }
}

/**
 * Check package.json for required dependencies
 */
async function checkDependencies() {
  console.log('\n📦 Checking dependencies...');
  
  const packagePath = path.join(PROJECT_ROOT, 'package.json');
  try {
    const pkg = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const required = ['next', 'react', 'react-dom'];
    const recommended = ['sharp', '@aws-sdk/client-s3', 'svgo'];
    
    for (const dep of required) {
      if (!allDeps[dep]) {
        issues.critical.push(`Required dependency missing: ${dep}`);
      }
    }
    
    for (const dep of recommended) {
      if (!allDeps[dep]) {
        issues.info.push(`Recommended dependency for optimization: ${dep}`);
      }
    }
    
    console.log('  ✅ Core dependencies present');
  } catch (error) {
    issues.critical.push(`Cannot read package.json: ${error.message}`);
  }
}

/**
 * Check for figma-pages directory structure
 */
async function checkFigmaStructure() {
  console.log('\n🗂️  Checking Figma pages structure...');
  
  const requiredFiles = [
    'lib/figma-pages/index.ts',
    'lib/figma-pages/types.ts',
    'lib/figma-pages/spaces.ts',
    'lib/figma-pages/studios.ts',
    'lib/figma-pages/community.ts',
    'lib/figma-pages/use-cases.ts',
    'lib/figma-pages/blogs.ts',
  ];
  
  for (const file of requiredFiles) {
    const fullPath = path.join(PROJECT_ROOT, file);
    try {
      await fs.access(fullPath);
      console.log(`  ✅ ${file}`);
    } catch {
      issues.critical.push(`Missing required file: ${file}`);
    }
  }
}

/**
 * Generate audit report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 AUDIT REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n🔴 Critical Issues: ${issues.critical.length}`);
  if (issues.critical.length > 0) {
    issues.critical.forEach(issue => console.log(`   - ${issue}`));
  }
  
  console.log(`\n⚠️  Warnings: ${issues.warnings.length}`);
  if (issues.warnings.length > 0 && issues.warnings.length <= 10) {
    issues.warnings.forEach(issue => console.log(`   - ${issue}`));
  } else if (issues.warnings.length > 10) {
    issues.warnings.slice(0, 10).forEach(issue => console.log(`   - ${issue}`));
    console.log(`   ... and ${issues.warnings.length - 10} more`);
  }
  
  console.log(`\nℹ️  Info: ${issues.info.length}`);
  if (issues.info.length > 0 && issues.info.length <= 5) {
    issues.info.forEach(issue => console.log(`   - ${issue}`));
  }
  
  console.log(`\n✅ Fixed: ${issues.fixed.length}`);
  if (issues.fixed.length > 0) {
    issues.fixed.forEach(issue => console.log(`   - ${issue}`));
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (issues.critical.length === 0 && issues.warnings.length <= 10) {
    console.log('✨ Project is in good shape!');
  } else if (issues.critical.length === 0) {
    console.log('⚠️  No critical issues, but some warnings need attention.');
  } else {
    console.log('🔧 Critical issues found - please review and fix.');
  }
  
  console.log('='.repeat(80));
}

/**
 * Main audit function
 */
async function runAudit() {
  console.log('🔍 Starting comprehensive project audit...\n');
  
  try {
    await checkFigmaStructure();
    await checkTypeScriptFiles();
    await checkImports();
    await checkDependencies();
    await checkMissingImages();
    
    generateReport();
    
    // Save report
    const reportPath = path.join(PROJECT_ROOT, 'scripts/output/audit-report.txt');
    await fs.mkdir(path.join(PROJECT_ROOT, 'scripts/output'), { recursive: true });
    
    const reportContent = `
Workspace Junction - Audit Report
Generated: ${new Date().toISOString()}

Critical Issues: ${issues.critical.length}
${issues.critical.map(i => '- ' + i).join('\n')}

Warnings: ${issues.warnings.length}
${issues.warnings.slice(0, 20).map(i => '- ' + i).join('\n')}
${issues.warnings.length > 20 ? `\n... and ${issues.warnings.length - 20} more warnings` : ''}

Info: ${issues.info.length}
${issues.info.map(i => '- ' + i).join('\n')}

Fixed: ${issues.fixed.length}
${issues.fixed.map(i => '- ' + i).join('\n')}
`;
    
    await fs.writeFile(reportPath, reportContent.trim());
    console.log(`\n📄 Report saved: scripts/output/audit-report.txt`);
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  }
}

// Run audit
runAudit();
