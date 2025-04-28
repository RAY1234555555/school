// pages/api/oauth2/callback.js
import { serialize } from 'cookie';
// --- !!! 再次确认这个导入路径是正确的 !!! ---
import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; 

export default async function handler(req, res) {
    console.log('--- Callback Start (Using Google ID Version) ---');
    // 打印有限的信息以避免日志过长
    console.log('[Callback] Request Query Keys:', Object.keys(req.query || {})); 
    console.log('[Callback] Request Cookie Keys:', Object.keys(req.cookies || {}));

    const { code, state } = req.query;
    const savedState = req.cookies.oauthState;

    // 1. Validate state
    if (!state || typeof state !== 'string' || !savedState || state !== savedState) {
        console.error('[Callback] STATE MISMATCH OR MISSING!', { hasReceivedState: !!state, hasSavedState: !!savedState });
        res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));
        console.log('--- Callback End (Redirect: invalid_state) ---');
        return res.redirect('/?error=invalid_state');
    }
    console.log('[Callback] State validated.');
    res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));

    // 2. Validate code
    if (!code || typeof code !== 'string') {
        console.error('[Callback] NO CODE received!');
        console.log('--- Callback End (Redirect: no_code) ---');
        return res.redirect('/?error=no_code');
    }
    console.log('[Callback] Code received.');

    try {
        // 3. Exchange code for tokens
        console.log('[Callback] Exchanging code...');
        // --- 调用你实现的函数 ---
        const { id_token, access_token } = await exchangeCodeForTokens(code); 
        if (!id_token || !access_token) {
            console.error('[Callback] Failed to retrieve tokens from exchangeCodeForTokens.');
            console.log('--- Callback End (Redirect: token_exchange_failed) ---');
            return res.redirect('/?error=token_exchange_failed');
        }
        console.log('[Callback] Tokens received successfully.');

        // 4. Get Google Profile
        console.log('[Callback] Getting Google profile...');
         // --- 调用你实现的函数 ---
        const googleProfile = await getGoogleProfile(id_token, access_token); 
        console.log('[Callback] Google Profile keys received:', Object.keys(googleProfile || {})); // 只打印键名

        // 5. Validate Profile
        const googleUserId = googleProfile?.sub || googleProfile?.id; // ?. 安全访问
        const email = googleProfile?.email;
        const fullName = googleProfile?.name || `${googleProfile?.given_name || ''} ${googleProfile?.family_name || ''}`.trim() || email?.split('@')[0];

        if (!googleUserId || !email) {
            console.error('[Callback] INCOMPLETE PROFILE! Missing googleUserId (sub/id) or email.');
            console.log('--- Callback End (Redirect: profile_incomplete) ---');
            return res.redirect('/?error=profile_incomplete');
        }
        console.log('[Callback] Profile validated:', { hasGoogleUserId: !!googleUserId, hasEmail: !!email });

        // 6. Validate domain
        const requiredDomain = '@kzxy.edu.kg'; // 你的域名
        if (!email.endsWith(requiredDomain)) {
            console.warn('[Callback] UNAUTHORIZED DOMAIN:', email);
            console.log('--- Callback End (Redirect: forbidden) ---');
            return res.redirect(`/forbidden?reason=domain&attempted=${encodeURIComponent(email)}`);
        }
        console.log('[Callback] Domain validated.');

        // 7. Set Cookies (Using the long Google ID)
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'Lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days expiry
        };
        // *** 决定用哪个 cookie 名称存储 Google ID ***
        // 保持一致性，建议只用一个，例如 oauthStudentId
        const studentIdCookieName = 'oauthStudentId'; 
        console.log(`[Callback] Setting cookies with Google User ID (${googleUserId}) in cookie: ${studentIdCookieName}`);
        res.setHeader('Set-Cookie', [
            serialize('oauthUsername', email, cookieOptions),
            serialize(studentIdCookieName, googleUserId, cookieOptions), // 存储 Google 长 ID
            serialize('oauthFullName', fullName || '', cookieOptions),
            serialize('oauthTrustLevel', '3', cookieOptions),
        ]);

        // 8. Redirect to Portal
        console.log('--- Callback End (Redirecting to portal successfully) ---');
        return res.redirect('/student-portal');

    } catch (error) {
        console.error('!!! OAUTH CALLBACK EXCEPTION !!!:', error.message || error);
        // 部署时可以考虑不暴露详细 stack trace
        // console.error(error.stack); 
        console.log('--- Callback End (Redirecting due to exception) ---');
        return res.redirect(`/?error=callback_exception&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
}
