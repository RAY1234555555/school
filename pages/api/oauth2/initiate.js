// pages/api/oauth2/initiate.js

import { v4 as uuidv4 } from 'uuid'; // 确保你已经安装了 uuid: npm install uuid

export default function handler(req, res) {
  // --- 调试日志开始 ---
  console.log('--- Initiate OAuth Start ---');
  console.log('Received request to initiate OAuth');

  // 读取环境变量
  const clientId = process.env.CLIENT_ID;
  const oauthRedirectUri = process.env.OAUTH_REDIRECT_URI;

  // 打印读取到的环境变量值 (注意：不在生产环境中长时间保留打印敏感信息)
  console.log('Read CLIENT_ID:', clientId);
  console.log('Read OAUTH_REDIRECT_URI:', oauthRedirectUri);

  // 检查环境变量是否存在
  if (!clientId || !oauthRedirectUri) {
    console.error('Error: CLIENT_ID or OAUTH_REDIRECT_URI environment variable is not set.');
    res.status(500).send('Server configuration error.');
    console.log('--- Initiate OAuth End (Error) ---');
    return;
  }

  // 对 Redirect URI 进行编码
  const encodedRedirectUri = encodeURIComponent(oauthRedirectUri);
  console.log('Encoded Redirect URI used:', encodedRedirectUri);

  // 生成 state 参数并设置 cookie
  const state = uuidv4();
  res.setHeader('Set-Cookie', `oauthState=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  console.log('Generated state:', state);

  // 构建 Google 授权 URL
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` + // scope 已编码
    `&redirect_uri=${encodedRedirectUri}` +
    `&state=${state}` +
    `&access_type=offline` + // 可选
    `&prompt=consent`;      // 可选, 强制显示同意屏幕

  // 打印最终生成的 URL
  console.log('Generated Auth URL:', authUrl);
  console.log('--- Initiate OAuth End (Redirecting) ---');
  // --- 调试日志结束 ---

  // 重定向用户到 Google
  res.redirect(authUrl);
}
