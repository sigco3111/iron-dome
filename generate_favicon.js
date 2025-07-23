// SVG를 PNG로 변환하고 favicon.ico 파일 생성하기
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function generateFavicon() {
  try {
    console.log('favicon.ico 생성 중...');
    
    // SVG 파일 읽기
    const svgContent = fs.readFileSync('./favicon.svg', 'utf8');
    
    // SVG를 Data URL로 변환
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    
    // 캔버스 생성
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    
    // SVG 이미지 로딩
    const img = await loadImage(svgDataUrl);
    
    // 캔버스에 그리기
    ctx.drawImage(img, 0, 0, 32, 32);
    
    // PNG 버퍼로 변환
    const pngBuffer = canvas.toBuffer('image/png');
    
    // PNG 파일로 저장
    fs.writeFileSync('./favicon.png', pngBuffer);
    
    console.log('favicon.png 생성 완료');
    console.log('favicon.ico 생성을 위해서는 온라인 변환 도구를 사용하세요:');
    console.log('https://www.favicon-generator.org/ 또는 https://convertio.co/png-ico/');
    
  } catch (error) {
    console.error('favicon 생성 중 오류 발생:', error);
  }
}

generateFavicon().catch(console.error);

// 사용 방법:
// 1. npm install canvas
// 2. node generate_favicon.js
// 3. 생성된 favicon.png 파일을 온라인 변환기로 favicon.ico로 변환 