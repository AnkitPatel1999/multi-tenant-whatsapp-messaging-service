const QRCode = require('qrcode');
const fs = require('fs');

// Demo QR code text (similar to what WhatsApp generates)
const demoQRText = '2@REK9ktsEzXOZNiExmNwcgN47C5oyxwEJoSuhevpGg3I+T2nRyPQ3ndHrupIalBrpsU4g3SBOhMrLNIvRLlIFj919PLgTN5iV/fU=,DWmUJGTrRFLgYN5txMSNhpYVVLRnjtpI7Q6rlOp4BRQ=,vR1xqsxZyIEoYcQ8qm4gS5LJZ8To+M9EPEN6JvoDh1k=,DD+tj6Y77y6E3fkDf1go8ByzjtV7AGFsHkjzCQDbhto=';

async function demonstrateQRCodeGeneration() {
  console.log('🔗 WhatsApp QR Code Generation Demo (PNG Only)');
  console.log('==============================================\n');
  
  try {
    // Generate PNG as data URL (base64)
    console.log('Generating PNG QR code...');
    const pngDataURL = await QRCode.toDataURL(demoQRText, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    console.log('✅ PNG QR code generated successfully');
    console.log(`   Length: ${pngDataURL.length} characters`);
    console.log(`   Preview: ${pngDataURL.substring(0, 50)}...\n`);

    // Save PNG file for demonstration
    console.log('Saving PNG file...');
    const pngBase64 = pngDataURL.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync('demo-qr-code.png', pngBase64, 'base64');
    console.log('✅ PNG file saved: demo-qr-code.png\n');

    console.log('🎉 QR code generated successfully!');
    console.log('\n📱 You can now:');
    console.log('   • Use the PNG data URL in HTML img tags');
    console.log('   • Display the QR code in web browsers');
    console.log('   • Download the PNG file directly');
    
  } catch (error) {
    console.error('❌ Error generating QR code:', error.message);
  }
}

// Run the demonstration
demonstrateQRCodeGeneration();
