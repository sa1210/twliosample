const admin = require('firebase-admin');
const twilio = require('twilio');

// Firebase Admin初期化
// Cloud Functions環境では自動的に認証情報が設定されます
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Twilio クライアント初期化
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// 6桁のランダムな認証コードを生成
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 認証コードを送信する Cloud Function
 *
 * リクエストパラメータ:
 * - phoneNumber: 送信先の電話番号 (E.164形式: +819012345678)
 * - method: 送信方法 'sms' または 'voice'
 */
exports.sendVerificationCode = async (req, res) => {
  // CORSヘッダーを設定
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    const { phoneNumber, method = 'sms' } = req.body;

    // バリデーション
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber is required'
      });
    }

    if (!['sms', 'voice'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'method must be "sms" or "voice"'
      });
    }

    // 認証コード生成
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分後に期限切れ

    // Firestoreに保存（tw_プレフィックス付き）
    await db.collection('tw_verification_codes').doc(phoneNumber).set({
      code: verificationCode,
      phoneNumber: phoneNumber,
      method: method,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false
    });

    // Twilioで送信
    let twilioResponse;

    if (method === 'sms') {
      // SMS送信
      twilioResponse = await twilioClient.messages.create({
        body: `Your verification code is: ${verificationCode}`,
        from: twilioPhoneNumber,
        to: phoneNumber
      });
    } else {
      // 音声通話
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ja-JP">認証コードは、${verificationCode.split('').join('、')}、です。</Say>
  <Pause length="2"/>
  <Say language="ja-JP">もう一度繰り返します。認証コードは、${verificationCode.split('').join('、')}、です。</Say>
</Response>`;

      twilioResponse = await twilioClient.calls.create({
        twiml: twiml,
        from: twilioPhoneNumber,
        to: phoneNumber
      });
    }

    console.log(`Verification code sent via ${method} to ${phoneNumber}. Twilio SID: ${twilioResponse.sid}`);

    res.status(200).json({
      success: true,
      message: `Verification code sent via ${method}`,
      twilioSid: twilioResponse.sid,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send verification code'
    });
  }
};

/**
 * 認証コードを検証する Cloud Function
 *
 * リクエストパラメータ:
 * - phoneNumber: 電話番号 (E.164形式)
 * - code: 認証コード (6桁)
 */
exports.verifyCode = async (req, res) => {
  // CORSヘッダーを設定
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    const { phoneNumber, code } = req.body;

    // バリデーション
    if (!phoneNumber || !code) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and code are required'
      });
    }

    // Firestoreから認証コードを取得
    const docRef = db.collection('tw_verification_codes').doc(phoneNumber);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Verification code not found for this phone number'
      });
    }

    const data = doc.data();

    // 既に検証済みかチェック
    if (data.verified) {
      return res.status(400).json({
        success: false,
        error: 'This verification code has already been used'
      });
    }

    // 有効期限チェック
    const now = new Date();
    const expiresAt = data.expiresAt.toDate();

    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }

    // コードの検証
    if (data.code !== code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // 検証成功 - ドキュメントを更新
    await docRef.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Verification successful for ${phoneNumber}`);

    res.status(200).json({
      success: true,
      message: 'Verification successful',
      phoneNumber: phoneNumber
    });

  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify code'
    });
  }
};
