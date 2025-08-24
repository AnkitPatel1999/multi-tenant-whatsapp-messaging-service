import React, { useState, useEffect } from 'react';

/**
 * WhatsApp QR Code Display Component
 * 
 * This component demonstrates how to properly display QR codes
 * from your WhatsApp API response in a React application.
 */
const WhatsAppQRCode = ({ deviceId, authToken }) => {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate QR code
  const generateQRCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/whatsapp/devices/${deviceId}/qr`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.error === 0 && result.data.qrCodeImage) {
        setQrData(result.data);
      } else {
        throw new Error(result.confidentialErrorMessage || 'Failed to generate QR code');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      setError('Failed to generate QR code: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Download QR code
  const downloadQRCode = (base64String, filename = 'whatsapp-qr-code.png') => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64String}`;
    link.download = filename;
    link.click();
  };

  // Auto-generate QR code when component mounts
  useEffect(() => {
    if (deviceId && authToken) {
      generateQRCode();
    }
  }, [deviceId, authToken]);

  // Refresh QR code
  const refreshQRCode = () => {
    generateQRCode();
  };

  if (loading) {
    return (
      <div className="qr-container">
        <div className="loading">🔄 Generating QR Code...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qr-container">
        <div className="error">❌ {error}</div>
        <button onClick={refreshQRCode} className="retry-btn">
          🔄 Retry
        </button>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="qr-container">
        <div className="no-data">No QR code data available</div>
        <button onClick={generateQRCode} className="generate-btn">
          🔗 Generate QR Code
        </button>
      </div>
    );
  }

  return (
    <div className="whatsapp-qr-code">
      <h3>📱 WhatsApp QR Code</h3>
      
      {/* Method 1: Direct display using qrCodeImage (Recommended) */}
      <div className="qr-section">
        <h4>✅ Method 1: Direct Display (Recommended)</h4>
        <p>Using the <code>qrCodeImage</code> field directly:</p>
        <div className="qr-image-container">
          <img 
            src={qrData.qrCodeImage} 
            alt="WhatsApp QR Code" 
            className="qr-image"
            onError={(e) => {
              console.error('Failed to load QR code image');
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <div className="qr-fallback" style={{ display: 'none' }}>
            <p>❌ Image failed to load. Try Method 2 below.</p>
          </div>
        </div>
      </div>

      {/* Method 2: Manual construction using qrCodeBase64 */}
      <div className="qr-section">
        <h4>✅ Method 2: Manual Construction</h4>
        <p>Using the <code>qrCodeBase64</code> field:</p>
        <div className="qr-image-container">
          <img 
            src={`data:image/png;base64,${qrData.qrCodeBase64}`}
            alt="WhatsApp QR Code (Method 2)" 
            className="qr-image"
          />
        </div>
      </div>

      {/* QR Code Information */}
      <div className="qr-info">
        <div className="info-item">
          <strong>Device ID:</strong> {qrData.deviceId}
        </div>
        <div className="info-item">
          <strong>Status:</strong> 
          <span className={`status ${qrData.isConnected ? 'connected' : 'disconnected'}`}>
            {qrData.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
        {qrData.qrExpiry && (
          <div className="info-item">
            <strong>Expires:</strong> {new Date(qrData.qrExpiry).toLocaleString()}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="qr-actions">
        <button onClick={refreshQRCode} className="action-btn refresh">
          🔄 Refresh QR Code
        </button>
        
        <button 
          onClick={() => downloadQRCode(qrData.qrCodeBase64, `qr-${deviceId}.png`)}
          className="action-btn download"
        >
          💾 Download QR Code
        </button>
        
        <button 
          onClick={() => {
            // Copy QR code text to clipboard
            navigator.clipboard.writeText(qrData.qrCode);
            alert('QR code text copied to clipboard!');
          }}
          className="action-btn copy"
        >
          📋 Copy QR Text
        </button>
      </div>

      {/* Instructions */}
      <div className="qr-instructions">
        <h4>📱 How to Connect:</h4>
        <ol>
          <li>Open WhatsApp on your phone</li>
          <li>Go to <strong>Settings → Linked Devices → Link a Device</strong></li>
          <li>Point your phone camera at the QR code above</li>
          <li>Wait for the connection to complete</li>
        </ol>
        <p className="note">
          <strong>Note:</strong> QR codes expire in 5 minutes. If expired, click "Refresh QR Code".
        </p>
      </div>
    </div>
  );
};

/**
 * Alternative: Simple QR Code Display Component
 * 
 * Use this if you just need a basic QR code display
 */
export const SimpleQRCode = ({ qrCodeImage, qrCodeBase64, alt = "QR Code" }) => {
  // Try qrCodeImage first, fallback to qrCodeBase64
  const imageSrc = qrCodeImage || `data:image/png;base64,${qrCodeBase64}`;
  
  if (!imageSrc) {
    return <div className="no-qr">No QR code available</div>;
  }

  return (
    <img 
      src={imageSrc} 
      alt={alt} 
      className="qr-code-simple"
      onError={(e) => {
        console.error('Failed to load QR code image');
        e.target.style.display = 'none';
      }}
    />
  );
};

/**
 * QR Code with Download Button Component
 */
export const QRCodeWithDownload = ({ qrCodeBase64, filename = "qr-code.png", alt = "QR Code" }) => {
  const downloadQR = () => {
    if (qrCodeBase64) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${qrCodeBase64}`;
      link.download = filename;
      link.click();
    }
  };

  return (
    <div className="qr-with-download">
      <img 
        src={`data:image/png;base64,${qrCodeBase64}`} 
        alt={alt} 
        className="qr-code"
      />
      <button onClick={downloadQR} className="download-btn">
        💾 Download
      </button>
    </div>
  );
};

export default WhatsAppQRCode;

/**
 * CSS Styles (add to your CSS file)
 * 
 * .whatsapp-qr-code {
 *   max-width: 500px;
 *   margin: 0 auto;
 *   padding: 20px;
 *   border: 1px solid #ddd;
 *   border-radius: 8px;
 *   background: white;
 * }
 * 
 * .qr-section {
 *   margin: 20px 0;
 *   padding: 15px;
 *   border: 1px solid #eee;
 *   border-radius: 5px;
 * }
 * 
 * .qr-image-container {
 *   text-align: center;
 *   margin: 15px 0;
 * }
 * 
 * .qr-image {
 *   max-width: 250px;
 *   height: auto;
 *   border: 2px solid #ddd;
 *   border-radius: 5px;
 * }
 * 
 * .qr-info {
 *   background: #f8f9fa;
 *   padding: 15px;
 *   border-radius: 5px;
 *   margin: 15px 0;
 * }
 * 
 * .info-item {
 *   margin: 8px 0;
 * }
 * 
 * .status.connected {
 *   color: #28a745;
 * }
 * 
 * .status.disconnected {
 *   color: #dc3545;
 * }
 * 
 * .qr-actions {
 *   display: flex;
 *   gap: 10px;
 *   flex-wrap: wrap;
 *   margin: 15px 0;
 * }
 * 
 * .action-btn {
 *   padding: 10px 15px;
 *   border: none;
 *   border-radius: 5px;
 *   cursor: pointer;
 *   font-size: 14px;
 * }
 * 
 * .action-btn.refresh {
 *   background: #007bff;
 *   color: white;
 * }
 * 
 * .action-btn.download {
 *   background: #28a745;
 *   color: white;
 * }
 * 
 * .action-btn.copy {
 *   background: #6c757d;
 *   color: white;
 * }
 * 
 * .qr-instructions {
 *   background: #e7f3ff;
 *   padding: 15px;
 *   border-radius: 5px;
 *   margin: 15px 0;
 * }
 * 
 * .qr-instructions ol {
 *   margin: 10px 0;
 *   padding-left: 20px;
 * }
 * 
 * .note {
 *   font-style: italic;
 *   color: #666;
 *   margin-top: 10px;
 * }
 * 
 * .loading, .error, .no-data {
 *   text-align: center;
 *   padding: 20px;
 *   font-size: 16px;
 * }
 * 
 * .error {
 *   color: #dc3545;
 *   background: #f8d7da;
 *   border-radius: 5px;
 * }
 * 
 * .retry-btn, .generate-btn {
 *   display: block;
 *   margin: 10px auto;
 *   padding: 10px 20px;
 *   background: #007bff;
 *   color: white;
 *   border: none;
 *   border-radius: 5px;
 *   cursor: pointer;
 * }
 */
