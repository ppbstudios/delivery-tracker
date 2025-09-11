const fs = require('fs');
const path = require('path');

// 기본적인 JavaScript to TypeScript 변환 함수
function convertCarrierToTS(originalContent, carrierName) {
  let converted = originalContent;

  // 기본 imports 추가
  const typeImports = `import { 
  ShippingStatus, 
  ShippingInformation, 
  CarrierModule,
  TrackingError 
} from '../../types/carrier';

`;

  // require 문들을 import로 변환
  const imports = [];
  
  if (converted.includes("require('axios')")) {
    imports.push("import axios from 'axios';");
    converted = converted.replace(/const\s+axios\s*=\s*require\(['"]axios['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('jsdom')")) {
    imports.push("import { JSDOM } from 'jsdom';");
    converted = converted.replace(/const\s*{\s*JSDOM\s*}\s*=\s*require\(['"]jsdom['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('cheerio')")) {
    imports.push("import * as cheerio from 'cheerio';");
    converted = converted.replace(/const\s+cheerio\s*=\s*require\(['"]cheerio['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('querystring')")) {
    imports.push("import * as qs from 'querystring';");
    converted = converted.replace(/const\s+qs\s*=\s*require\(['"]querystring['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('tough-cookie')")) {
    imports.push("import { Cookie } from 'tough-cookie';");
    converted = converted.replace(/const\s*{\s*Cookie\s*}\s*=\s*require\(['"]tough-cookie['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('iconv')")) {
    imports.push("import { Iconv } from 'iconv';");
    converted = converted.replace(/const\s*{\s*Iconv\s*}\s*=\s*require\(['"]iconv['"]\);?\s*/g, '');
  }
  
  if (converted.includes("require('html-entities')")) {
    imports.push("import { XmlEntities as Entities } from 'html-entities';");
    converted = converted.replace(/const\s+Entities\s*=\s*require\(['"]html-entities['"]\)\.XmlEntities;?\s*/g, '');
  }

  // 다른 carrier 모듈 참조 처리
  const relativeRequire = /const\s+(\w+)\s*=\s*require\(['"]\.\.\/([^'"]+)['"]\);?/g;
  let match;
  while ((match = relativeRequire.exec(converted)) !== null) {
    imports.push(`import ${match[1]} from '../${match[2]}';`);
    converted = converted.replace(match[0], '');
  }

  // imports를 맨 위에 추가
  converted = imports.join('\n') + '\n' + typeImports + '\n' + converted;

  // getTrack 함수에 타입 추가
  converted = converted.replace(
    /function\s+getTrack\s*\(\s*trackId\s*\)/g,
    'function getTrack(trackId: string): Promise<ShippingInformation>'
  );

  // Promise에 타입 추가
  converted = converted.replace(
    /new\s+Promise\s*\(\s*\(\s*resolve\s*,\s*reject\s*\)\s*=>/g,
    'new Promise<ShippingInformation>((resolve, reject) =>'
  );

  // 함수 매개변수에 기본 타입 추가
  converted = converted.replace(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    'function $1($2: string)'
  );
  
  converted = converted.replace(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    'function $1($2: string, $3: string)'
  );
  
  converted = converted.replace(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\)/g,
    'function $1($2: string, $3: string, $4: string)'
  );

  // const 함수들에 타입 추가
  converted = converted.replace(
    /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g,
    'const $1 = ($2: string) =>'
  );

  // module.exports를 export =로 변환
  const moduleExportRegex = /module\.exports\s*=\s*{([\s\S]*?)};?\s*$/;
  const moduleMatch = moduleExportRegex.exec(converted);
  
  if (moduleMatch) {
    const moduleContent = moduleMatch[1].trim();
    converted = converted.replace(moduleExportRegex, 
      `const carrierModule: CarrierModule = {\n${moduleContent}\n};\n\nexport = carrierModule;`
    );
  }

  // 타입 관련 수정
  converted = converted.replace(
    /reject\s*\(\s*{\s*code:\s*(\d+),\s*message:\s*([^}]+)\s*}\s*\)/g,
    'reject({ code: $1, message: $2 } as TrackingError)'
  );

  // 일반적인 변수 타입 추가 (간단한 경우만)
  converted = converted.replace(/: null,/g, ': undefined,');
  
  return converted;
}

// 변환할 carriers 목록
const carriersToConvert = [
  'jp.yuubin', 'kr.chunilps', 'kr.cjlogistics', 'kr.cupost', 
  'kr.cvsnet', 'kr.cway', 'kr.daesin', 'kr.epost', 'kr.hanips', 
  'kr.hdexp', 'kr.homepick', 'kr.honamlogis', 'kr.ilyanglogis',
  'kr.kdexp', 'kr.kunyoung', 'kr.logen', 'kr.lotte', 'kr.slx',
  'kr.swgexp', 'nl.tnt', 'un.upu.ems', 'us.fedex', 'us.ups', 'us.usps'
];

console.log(`Converting ${carriersToConvert.length} carriers to TypeScript...`);

carriersToConvert.forEach(carrierName => {
  const jsPath = path.join('carriers', carrierName, 'index.js');
  const tsPath = path.join('carriers', carrierName, 'index.ts');
  
  if (fs.existsSync(jsPath)) {
    try {
      const originalContent = fs.readFileSync(jsPath, 'utf8');
      const converted = convertCarrierToTS(originalContent, carrierName);
      fs.writeFileSync(tsPath, converted);
      console.log(`✅ ${carrierName}/index.js → index.ts`);
    } catch (error) {
      console.error(`❌ Failed to convert ${carrierName}:`, error.message);
    }
  } else {
    console.warn(`⚠️  File not found: ${jsPath}`);
  }
});

console.log('\nConversion completed!');
