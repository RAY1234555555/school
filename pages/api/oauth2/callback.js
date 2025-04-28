// pages/api/oauth2/callback.js
import { serialize } from 'cookie';
// --- 确保这个导入路径正确 ---
import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; 

export default async function handler(req, res) {
    console.log('--- Callback Start (Using Google Sub ID Version) ---');
    console.log('[Callback] Request Cookies:', JSON.stringify(req.cookies || {}));
    console.log('[Callback] Request Query:', JSON.stringify(req.query || {}));

    const { code, state } = req.query;
    const savedState = req.cookies.oauthState;

    // 1. Validate state
    if (!state || typeof state !== 'string' || !savedState || state !== savedState) {
        console.error('[Callback] STATE MISMATCH OR MISSING!', { received: state, expected: savedState });
        res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));
        console.log('--- Callback End (Redirecting due to invalid state) ---');
        return res.redirect('/?error=invalid_state');
    }
    console.log('[Callback] State validated successfully.');
    res.setHeader('Set-Cookie', serialize('oauthState', '', { path: '/', maxAge: -1 }));

    // 2. Validate code
    if (!code || typeof code !== 'string') {
        console.error('[Callback] NO CODE received!');
        console.log('--- Callback End (Redirecting due to no code) ---');
        return res.redirect('/?error=no_code');
    }
    console.log('[Callback] Code received.');

    try {
        // 3. Exchange code for tokens
        console.log('[Callback] Attempting to exchange code for tokens...');
        const { id_token, access_token } = await exchangeCodeForTokens(code);
        if (!id_token || !access_token) {
            console.error('[Callback] Failed to retrieve tokens from exchange.');
            console.log('--- Callback End (Redirecting due to token exchange failure) ---');
            return res.redirect('/?error=token_exchange_failed');
        }
        console.log('[Callback] Tokens received successfully.');

        // 4. Get Google Profile
        console.log('[Callback] Attempting to get Google profile...');
        const googleProfile = await getGoogleProfile(id_token, access_token);
        console.log('[Callback] Google Profile received:', JSON.stringify(googleProfile, null, 2));

        // 5. Validate profile
        const googleSub = googleProfile.sub; // Google's unique user ID (the long one)
        const email = googleProfile.email;
        const fullName = googleProfile.name || `${googleProfile.given_name || ''} ${googleProfile.family_name || ''}`.trim() || email.split('@')[0];

        if (!googleSub || !email) {
            console.error('[Callback] INCOMPLETE PROFILE from Google! Missing sub or email.');
            console.log('--- Callback End (Redirecting due to incomplete profile) ---');
            return res.redirect('/?error=profile_incomplete');
        }
        console.log('[Callback] Profile contains essential info:', { googleSub: googleSub, email: email });

        // 6. Validate domain
        const requiredDomain = '@kzxy.edu.kg'; // Your domain
        if (!email.endsWith(requiredDomain)) {
            console.warn('[Callback] UNAUTHORIZED DOMAIN:', email);
            console.log('--- Callback End (Redirecting to forbidden page) ---');
            return res.redirect(`/forbidden?reason=domain&attempted=${encodeURIComponent(email)}`);
        }
        console.log('[Callback] Domain validated successfully.');

        // 7. Set Cookies - Storing the LONG Google Sub ID in oauthUserId
        const cookieOptions = {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'Lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days expiry
        };
        console.log('[Callback] Setting cookies with Google Sub ID:', googleSub);
        res.setHeader('Set-Cookie', [
            serialize('oauthUsername', email, cookieOptions),
            // *** Storing Google's long ID ***
            serialize('oauthUserId', googleSub, cookieOptions), 
            serialize('oauthFullName', fullName || '', cookieOptions),
            serialize('oauthTrustLevel', '3', cookieOptions),
            // You might want to remove oauthStudentId if you exclusively use oauthUserId now
             serialize('oauthStudentId', '', { ...cookieOptions, maxAge: -1 }), // Example: Expire old cookie
        ]);

        // 8. Redirect to Portal
        console.log('--- Callback End (Redirecting to portal successfully) ---');
        return res.redirect('/student-portal');

    } catch (error) {
        console.error('!!! OAUTH CALLBACK EXCEPTION !!!:', error.message || error);
        console.error(error.stack); 
        console.log('--- Callback End (Redirecting due to exception) ---');
        return res.redirect(`/?error=callback_exception&message=${encodeURIComponent(error.message || 'Unknown error')}`);
    }
}
