// === 文件 2：pages/api/set-cookie.js ===

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { oauthUsername, oauthEmail, oauthPersonalEmail, oauthStudentId } = req.body;

  if (!oauthUsername || !oauthEmail || !oauthStudentId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  res.setHeader('Set-Cookie', [
    `oauthUsername=${encodeURIComponent(oauthUsername)}; Path=/; HttpOnly`,
    `oauthEmail=${encodeURIComponent(oauthEmail)}; Path=/; HttpOnly`,
    `oauthPersonalEmail=${encodeURIComponent(oauthPersonalEmail || '')}; Path=/; HttpOnly`,
    `oauthStudentId=${encodeURIComponent(oauthStudentId)}; Path=/; HttpOnly`
  ]);

  res.status(200).json({ message: 'Cookies set successfully' });
}
