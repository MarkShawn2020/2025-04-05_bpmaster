const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 图标配置：文件名和尺寸
const icons = [
  // 功能图标
  { name: 'feature-upload', size: 80 },
  { name: 'feature-analysis', size: 80 },
  { name: 'feature-report', size: 80 },
  { name: 'feature-compare', size: 80 },
  
  // TabBar图标 - 微信要求尺寸为81x81像素，居中显示
  { name: 'home', size: 81 },
  { name: 'home-active', size: 81 },
  { name: 'upload', size: 81 },
  { name: 'upload-active', size: 81 },
  { name: 'history', size: 81 },
  { name: 'history-active', size: 81 },
  
  // 文件类型图标
  { name: 'file-pdf', size: 40 },
  { name: 'file-doc', size: 40 },
  { name: 'file-ppt', size: 40 },
  { name: 'file-txt', size: 40 },
  { name: 'upload-file', size: 60 },
  { name: 'success', size: 60 }
];

// 源目录和目标目录
const sourceDir = path.join(__dirname, 'assets/icons');
const targetDir = path.join(__dirname, 'assets/icons');

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 转换每个SVG到PNG
async function convertSvgToPng() {
  try {
    for (const icon of icons) {
      const svgPath = path.join(sourceDir, `${icon.name}.svg`);
      const pngPath = path.join(targetDir, `${icon.name}.png`);
      
      // 检查SVG文件是否存在
      if (!fs.existsSync(svgPath)) {
        console.error(`SVG文件不存在: ${svgPath}`);
        continue;
      }
      
      console.log(`正在转换: ${icon.name}.svg → ${icon.name}.png`);
      
      await sharp(svgPath)
        .resize(icon.size, icon.size)
        .png()
        .toFile(pngPath);
      
      console.log(`已生成: ${pngPath}`);
    }
    
    console.log('所有SVG文件已成功转换为PNG！');
  } catch (error) {
    console.error('转换过程中发生错误:', error);
  }
}

// 创建缺失的SVG文件
function createMissingSvgFiles() {
  const tabBarIcons = {
    // TabBar图标 - 直接使用填满整个画布的图标
    'home': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M40.5 10L10 40.5h10v30h20v-20h20v20h10v-30h10L40.5 10z" fill="#8E9AAF"/></svg>',
    'home-active': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M40.5 10L10 40.5h10v30h20v-20h20v20h10v-30h10L40.5 10z" fill="#3563E9"/></svg>',
    'upload': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M15 65h50v-8H15v8zm0-35h15v20h20V30h15L40.5 10 15 30z" fill="#8E9AAF"/></svg>',
    'upload-active': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M15 65h50v-8H15v8zm0-35h15v20h20V30h15L40.5 10 15 30z" fill="#3563E9"/></svg>',
    'history': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M40 15c-14 0-25 11-25 25H5l10 10 10-10h-10c0-14 11-25 25-25s25 11 25 25-11 25-25 25c-7 0-13-3-17-7l-5 5c6 6 14 9 22 9 14 0 25-11 25-25s-11-25-25-25zm-5 15v15l12 7 3-5-10-6V30h-5z" fill="#8E9AAF"/></svg>',
    'history-active': '<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 81 81"><rect width="81" height="81" fill="none"/><path d="M40 15c-14 0-25 11-25 25H5l10 10 10-10h-10c0-14 11-25 25-25s25 11 25 25-11 25-25 25c-7 0-13-3-17-7l-5 5c6 6 14 9 22 9 14 0 25-11 25-25s-11-25-25-25zm-5 15v15l12 7 3-5-10-6V30h-5z" fill="#3563E9"/></svg>',
    
    // 其他图标保持不变
    'file-pdf': '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#FF6B6B"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v1.25c0 .41-.34.75-.75.75s-.75-.34-.75-.75V8c0-.55.45-1 1-1H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2c-.28 0-.5-.22-.5-.5v-5c0-.28.22-.5.5-.5h2c.83 0 1.5.67 1.5 1.5v3zm4-3.75c0 .41-.34.75-.75.75H19v1h.75c.41 0 .75.34.75.75s-.34.75-.75.75H19v1h.75c.41 0 .75.34.75.75s-.34.75-.75.75H18c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1h2.25c.41 0 .75.34.75.75zM9 9.5h1v-1H9v1zM3 6c-.55 0-1 .45-1 1v13c0 1.1.9 2 2 2h13c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1-.45-1-1V7c0-.55-.45-1-1-1zm11 5.5h1v-3h-1v3z"/></svg>',
    'file-doc': '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#3563E9"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    'file-ppt': '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#FFA726"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>',
    'file-txt': '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#78909C"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    'upload-file': '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="#3563E9"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>',
    'success': '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="#52C41A"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>'
  };

  // 确保assets/icons目录存在
  if (!fs.existsSync(sourceDir)) {
    fs.mkdirSync(sourceDir, { recursive: true });
    console.log(`创建目录: ${sourceDir}`);
  }

  // 强制更新SVG文件，无论是否已存在
  Object.keys(tabBarIcons).forEach(iconName => {
    const svgFilePath = path.join(sourceDir, `${iconName}.svg`);
    fs.writeFileSync(svgFilePath, tabBarIcons[iconName]);
    console.log(`更新SVG文件: ${svgFilePath}`);
  });
}

// 确保源目录存在
if (!fs.existsSync(sourceDir)) {
  fs.mkdirSync(sourceDir, { recursive: true });
}

// 创建缺失的SVG文件，然后转换
createMissingSvgFiles();
convertSvgToPng(); 