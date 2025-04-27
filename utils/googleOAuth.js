// utils/googleOAuth.js

import axios from 'axios';

// 通过OAuth2 code换取tokens
export async function exchangeCodeForTokens(code) {
  console.log('--- exchangeCodeForTokens Start ---'); // 保留日志
  const url = 'https://oauth2.googleapis.com/token';

  // 读取环境变量 (保持 GOOGLE_ 前缀)
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // !!! 修改这里，统一使用 OAUTH_REDIRECT_URI !!!
  const redirectUri = process.env.OAUTH_REDIRECT_URI;

  // 打印读取到的值 (调试后记得移除 Secret 的打印)
  console.log('Read GOOGLE_CLIENT_ID in exchangeCodeForTokens:', clientId);
  console.log('Read GOOGLE_CLIENT_SECRET in exchangeCodeForTokens:', clientSecret ? '********' : undefined); // 掩码 Secret
  console.log('Read OAUTH_REDIRECT_URI in exchangeCodeForTokens:', redirectUri);

  if (!clientId || !clientSecret || !redirectUri) {
      console.error('Error in exchangeCodeForTokens: Missing Google OAuth env vars.');
      throw new Error('Server configuration error in token exchange.'); // 抛出错误更明确
  }

  const values = {
    code,
    client_id: clientId,       // 使用变量
    client_secret: clientSecret, // 使用变量
    redirect_uri: redirectUri, // 使用变量 (来源已统一)
    grant_type: 'authorization_code',
  };

  try {
    const res = await axios.post(url, new URLSearchParams(values), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    console.log('--- exchangeCodeForTokens Success ---');
    return res.data; // 成功时返回数据
  } catch (error) {
    console.error('--- exchangeCodeForTokens Error ---');
    // 打印更详细的错误信息，特别是 Google 返回的响应体
    if (error.response) {
      console.error('Google Token API Error Response Status:', error.response.status);
      console.error('Google Token API Error Response Data:', error.response.data);
    } else {
      console.error('Axios request error:', error.message);
    }
    throw error; // 将错误继续向上抛出，让 callback.js 能捕获到
  }
}

// 用access_token拿到Google profile信息 (修正 Authorization Header)
export async function getGoogleProfile(id_token, access_token) {
  console.log('--- getGoogleProfile Start ---');
  // 优先：验证 id_token 并从中提取信息是更推荐的做法
  // import { OAuth2Client } from 'google-auth-library';
  // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  // try {
  //   const ticket = await client.verifyIdToken({
  //       idToken: id_token,
  //       audience: process.env.GOOGLE_CLIENT_ID,
  //   });
  //   const payload = ticket.getPayload();
  //   console.log('ID Token Payload:', payload);
  //   console.log('--- getGoogleProfile Success (from ID Token) ---');
  //   return payload; // 直接返回 payload，包含 email, name, sub, picture 等
  // } catch (error) {
  //   console.error('Error verifying ID token:', error);
  //   throw new Error('Failed to verify ID token.');
  // }

  // 如果坚持调用 UserInfo API (确保 access_token 有效且包含必要 scope)
  console.log('Attempting to fetch profile using UserInfo endpoint...');
  const url = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json`; // URL 中无需 access_token

  try {
      const res = await axios.get(url, {
          headers: {
              // !!! 使用 access_token !!!
              Authorization: `Bearer ${access_token}`,
          },
      });
      console.log('--- getGoogleProfile Success (from UserInfo API) ---');
      return res.data;
  } catch (error) {
      console.error('--- getGoogleProfile Error ---');
      if (error.response) {
          console.error('Google UserInfo API Error Response Status:', error.response.status);
          console.error('Google UserInfo API Error Response Data:', error.response.data);
      } else {
          console.error('Axios request error:', error.message);
      }
      throw error; // 将错误继续向上抛出
  }
}
