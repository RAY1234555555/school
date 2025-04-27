export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { oauthUsername, oauthEmail, oauthPersonalEmail } = req.body;

  if (!oauthUsername || !oauthEmail) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const studentId = Math.floor(10000000 + Math.random() * 90000000).toString();

  res.setHeader('Set-Cookie', [
    `oauthUsername=${encodeURIComponent(oauthUsername)}; Path=/; HttpOnly`,
    `oauthEmail=${encodeURIComponent(oauthEmail)}; Path=/; HttpOnly`,
    `oauthPersonalEmail=${encodeURIComponent(oauthPersonalEmail || '')}; Path=/; HttpOnly`,
    `oauthStudentId=${studentId}; Path=/; HttpOnly`
  ]);

  res.status(200).json({ message: 'Cookies set successfully' });
}
