// pages/api/oauth2/callback.js
import { serialize } from 'cookie';
// --- 确保导入路径正确 ---
import { exchangeCodeForTokens, getGoogleProfile } from '../../../utils/googleOAuth'; 

export default async function handler(req, res) {
    console.log('--- Callback Start (Using Google ID Version) ---');
    console.log('[Callback] Request Cookies:', JSON.stringify(req.cookies || {}));
    console.log('[Callback] Request Query:', JSON.stringify(req.query || {}));

    const { code, state } = req.query;
    const savedState = req.cookies.oauthState;

    // 1. Validate state
    if (!state || typeof state !== 'string' || !savedState || state !== savedState) {
        console.error('[Callback] STATE MISMATCH OR MISSING!', { received: state, expected: savedState });
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
        const { id_token, access_token } = await exchangeCodeForTokens(code);
        if (!id_token || !access_token) {
            console.error('[Callback] Failed to retrieve tokens.');
            console.log('--- Callback End (Redirect: token_exchange_failed) ---');
            return res.redirect('/?error=token_exchange_failed');
        }
        console.log('[Callback] Tokens received.');

        // 4. Get Google Profile
        console.log('[Callback] Getting Google profile...');
        const googleProfile = await getGoogleProfile(id_token, access_token);
        console.log('[Callback] Google Profile:', JSON.stringify(googleProfile, null, 2));

        // 5. Validate Profile (Using 'id' or 'sub' from Google)
        // Google's userinfo endpoint often returns 'id', while ID tokens use 'sub'. Check both.
        const googleUserId = googleProfile.sub || googleProfile.id; 
        const email = googleProfile.email;
        const fullName = googleProfile.name || `${googleProfile.given_name || ''} ${googleProfile.family_name || ''}`.trim() || email.split('@')[0];

        // *** Important: Check googleUserId and email ***
        if (!googleUserId || !email) { 
            console.error('[Callback] INCOMPLETE PROFILE! Missing googleUserId (sub/id) or email.', { googleUserId, email });
            console.log('--- Callback End (Redirect: profile_incomplete) ---');
            return res.redirect('/?error=profile_incomplete');
        }
        console.log('[Callback] Profile validated:', { googleUserId, email });

        // 6. Validate domain
        const requiredDomain = '@kzxy.edu.kg'; // Your domain
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
        console.log('[Callback] Setting cookies with Google User ID:', googleUserId);
        res.setHeader('Set-Cookie', [
            serialize('oauthUsername', email, cookieOptions),
            // *** Store the long Google User ID ***
            serialize('oauthUserId', googleUserId, cookieOptions), // Use oauthUserId or oauthStudentId, be consistent!
            serialize('oauthStudentId', googleUserId, cookieOptions), // Store it in both for compatibility if needed? Or choose one.
            serialize('oauthFullName', fullName || '', cookieOptions),
            serialize('oauthTrustLevel', '3', cookieOptions),
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


// --- You still need the placeholder functions or actual implementations ---
// --- for exchangeCodeForTokens and getGoogleProfile in ../../../utils/googleOAuth ---
/* 
async function exchangeCodeForTokens(code) { 
    // ... implementation to call Google's token endpoint ... 
    // return { id_token: '...', access_token: '...' };
    console.log("[exchangeCodeForTokens] Placeholder called with code:", code);
    // Replace with actual fetch logic
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const response = await fetch(tokenUrl, { /* ... fetch options ... */ });
    // ... error handling ...
    // return await response.json(); 
    // --- Dummy return for testing structure ---
     return { id_token: 'dummy_id_token_'+code, access_token: 'dummy_access_token_'+code };
}

async function getGoogleProfile(id_token, access_token) {
    // ... implementation using id_token verification or access_token userinfo call ...
    // return { sub: '123...', email: '...', name: '...' };
     console.log("[getGoogleProfile] Placeholder called");
     // --- Dummy return for testing structure ---
     // Simulate the structure you received in logs
      return {
          sub: "104151622473999384524", // Use 'sub' standardly from ID token
          id: "104151622473999384524",   // userinfo endpoint might use 'id'
          email: "info@kzxy.edu.kg",
          verified_email: true,
          name: "Frank Mavish",
          given_name: "Frank",
          family_name: "Mavish",
          picture: "https://lh3.googleusercontent.com/...",
          hd: "kzxy.edu.kg"
        };
}
*/
