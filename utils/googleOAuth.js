import axios from 'axios'

// 通过OAuth2 code换取tokens
export async function exchangeCodeForTokens(code) {
  const url = 'https://oauth2.googleapis.com/token'

  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/oauth2/callback`,
    grant_type: 'authorization_code',
  }

  const res = await axios.post(url, new URLSearchParams(values), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  return res.data
}

// 用id_token拿到Google profile信息
export async function getGoogleProfile(id_token, access_token) {
  const url = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${id_token}`,
    },
  })

  return res.data
}
