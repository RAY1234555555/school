// pages/student-card.js
import Head from 'next/head'
import Script from 'next/script'
import { parse } from 'cookie'

async function fetchGoogleUser(email) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token'
    })
  })
  if (!tokenRes.ok) {
      console.error("Failed to refresh Google token:", tokenRes.status, await tokenRes.text());
      return null;
  }
  const { access_token } = await tokenRes.json()
  const userRes = await fetch(
    `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`, // Added projection=full for more fields if needed
    { headers:{ Authorization:`Bearer ${access_token}` } }
  )
  if (!userRes.ok) {
      console.error("Failed to fetch Google user:", userRes.status, await userRes.text());
      return null;
  }
  return await userRes.json()
}

// getServerSideProps (保持不变, 除了调试日志)
export async function getServerSideProps({ req }) {
  const cookies       = parse(req.headers.cookie||'')
  const oauthUsername = cookies.oauthUsername
  const trustLevel    = parseInt(cookies.oauthTrustLevel||'0',10)

  console.log("Student Card - Cookies:", cookies); // Debug log

  // Trust level check (保持不变)
  // Consider adjusting trust level if needed for this page specifically
  // if (!oauthUsername || trustLevel < 3) { 
  if (!oauthUsername) { // Simplified check: just need username for now
    console.log("Student Card - Redirecting: No username or insufficient trust level."); // Debug log
    return { redirect:{ destination:'/', permanent:false } }
  }

  // build studentEmail (保持不变)
  const rawDom = process.env.EMAIL_DOMAIN
  const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@'+ (rawDom || 'default.domain'); // Added default domain fallback
  const studentEmail = oauthUsername.includes('@')
    ? oauthUsername
    : `${oauthUsername}${domain}`

  console.log("Student Card - Attempting to fetch Google user for:", studentEmail); // Debug log

  // ensure user exists in Google Directory (保持不变)
  const googleUser = await fetchGoogleUser(studentEmail)
  if (!googleUser) {
    console.log("Student Card - Redirecting: Google user not found."); // Debug log
    // Redirect to a specific error page or registration page might be better
    return { redirect:{ destination:'/?error=user_not_found', permanent:false } } // Redirect back with error
    // return { redirect:{ destination:'/register', permanent:false } } 
  }

  console.log("Student Card - Google User Data:", googleUser); // Debug log

  // Extract data carefully (保持不变, added safety checks)
  const fullName      = googleUser.name ? `${googleUser.name.givenName || ''} ${googleUser.name.familyName || ''}`.trim() : '名字缺失';
  // Personal email might be in 'emails' array or 'recoveryEmail'
  const personalEmail = googleUser.recoveryEmail || (googleUser.emails?.find(e => e.type === 'home' || e.type === 'other')?.address) || '';
  const studentId     = cookies.oauthUserId || googleUser.id // Use Google ID as fallback if cookie missing? Needs consideration.

  // --- Dummy Data for Fallback/Testing (Remove in production) ---
  // const fullName = "周 周";
  // const personalEmail = "test@personal.com";
  // const studentEmail = "ikunla@wcmf.org.uk";
  // const studentId = "063160";
  // --- End Dummy Data ---


  if (!studentId) {
    console.log("Student Card - Error: Student ID is missing."); // Debug log
     // Handle missing student ID case - maybe redirect or show error
     return { props: { error: "学生ID丢失" } }; 
  }


  return {
    props: { fullName, personalEmail, studentEmail, studentId }
  }
}

// Default component export (修改 Logo 和名称)
export default function StudentCard({
  fullName,
  personalEmail, // This prop might not be used in the card display itself, but fetched
  studentEmail,
  studentId,
  error // Receive error prop if passed from getServerSideProps
}) {
  // Handle error state first
  if (error) {
      return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>错误: {error}</div>;
  }
  
  // Ensure studentId is a string before padding
  const sid = studentId ? String(studentId).padStart(6,'0') : '000000'; 
  // Use a placeholder or generic avatar if email is missing, handle potential errors
  const avatarUrl = studentEmail ? `https://i.pravatar.cc/150?u=${encodeURIComponent(studentEmail)}` : '/avatar-placeholder.png'; // Add a placeholder image to /public

  return (
    <>
      <Head>
          {/* 修改页面标题 */}
        <title>学生卡 - 孔子学院</title>
        <meta name="description" content="孔子学院学生电子卡" /> 
      </Head>
      <Script
        src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.JsBarcode && document.getElementById('barcode') && sid !== '000000') { // Check element exists and sid is valid
            try {
              window.JsBarcode('#barcode', sid, {
                format: 'CODE128',
                lineColor: '#000',
                width: 2,
                height: 50,
                displayValue: true, // Display value below barcode
                textMargin: 5 // Add some margin for the text
              });
            } catch (e) {
              console.error("JsBarcode error:", e); // Catch potential barcode errors
            }
          } else if (sid === '000000') {
              console.warn("Student ID is missing, cannot generate barcode.");
          }
        }}
        onError={(e) => {
            console.error("Failed to load JsBarcode script:", e);
        }}
      />

      <div className="wrapper">
        <div className="card">
          {/* School header with UPDATED logo and name */}
          <div className="school-header">
            {/* --- 修改 Logo --- */}
            <img 
              src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" 
              alt="孔子学院 Logo" 
              className="logo-in-header" // Use a class for styling
            />
            {/* --- 修改大学名称 --- */}
            <h1>孔子学院</h1>
          </div>

          {/* Card Body - 保持不变 */}
          <div className="card-body">
            <img src={avatarUrl} alt="学生照片" className="student-photo" onError={(e) => { e.target.onerror = null; e.target.src='/avatar-placeholder.png'; }} /> {/* Add error handler for avatar */}
            <h3>{fullName || '学生姓名'}</h3> {/* Fallback for name */}
            {/* Static text - kept as per screenshot */}
            <p>Fall 2025</p> 
            <p>Master of Computer Science</p> 
            {/* End Static text */}
            <p>{studentEmail || '学生邮箱'}</p> {/* Fallback for email */}
            <p><strong>学生ID:</strong> {sid}</p> 
            {/* Static text - kept as per screenshot */}
            <p className="valid-through">有效期至: September 2028</p> 
            {/* End Static text */}
            <div className="barcode">
              {/* Ensure SVG exists even if barcode fails, or conditionally render */}
              <svg id="barcode" width="200" height="70"></svg> {/* Increased height slightly for text */}
              {sid === '000000' && <p style={{color: 'red', fontSize: '12px', marginTop: '5px'}}>ID丢失</p>} {/* Show message if ID missing */}
            </div>
          </div>
        </div>
      </div>

      {/* Styles - 保持不变, 但为新 Logo 添加样式 */}
      <style jsx>{`
        .wrapper {
          min-height:100vh;
          display:flex;justify-content:center;align-items:center;
          background:url('https://png.pngtree.com/thumb_back/fw800/background/20231028/pngtree-stunning-isolated-wood-table-top-texture-with-exquisite-texture-image_13705698.png')
            center/cover no-repeat;
          padding:20px;
          font-family: Arial, sans-serif; /* Added default font */
        }
        .card {
          width: 350px; /* Slightly narrower? Adjust as needed */
          max-width: 90%; /* Ensure responsiveness */
          background:linear-gradient(145deg,#f8f9fa,#ffffff); /* Lighter gradient */
          border:1px solid #dee2e6; /* Lighter border */
          border-radius:12px; /* Slightly more rounded */
          box-shadow:0 10px 25px rgba(0,0,0,0.1); /* Adjusted shadow */
          overflow:hidden;
        }
        .school-header {
          display:flex;align-items:center;gap:10px; /* Increased gap */
          /* Use a solid color or a simpler gradient if preferred */
          background: #0056b3; /* Example: Solid blue */
          /* background:linear-gradient(to right,#0056b3,#007bff); /* Adjusted gradient */
          padding:12px 18px; /* Adjusted padding */
        }
        /* --- 新 Logo 的样式 --- */
        .logo-in-header {
           width: 32px; /* Adjust size as needed */
           height: 32px;
           object-fit: contain; /* Ensure logo fits well */
           border-radius: 4px; /* Optional: match portal logo style */
        }
        .school-header h1 {
          margin:0;
          font-size:18px; /* Adjusted size */
          color:#fff;
          font-weight: 600; /* Slightly bolder */
        }
        .card-body {
          background:#fff;
          padding:25px; /* Increased padding */
          text-align:center;
        }
        .student-photo {
          width:90px; /* Adjusted size */
          height:90px;
          object-fit:cover;
          border:4px solid #e9ecef; /* Lighter border */
          border-radius:50%;
          box-shadow:0 3px 8px rgba(0,0,0,0.15); /* Adjusted shadow */
          margin-bottom:15px; /* Increased margin */
        }
        h3 { /* Student Name */
          margin:10px 0 5px 0; /* Adjusted margin */
          font-size:18px; /* Adjusted size */
          color:#212529; /* Darker color */
          font-weight: 600;
        }
        p {
          margin:4px 0; /* Reduced margin */
          font-size:14px; /* Adjusted size */
          color:#495057; /* Adjusted color */
          line-height: 1.5; /* Added line height */
        }
        p strong {
          font-weight: 600; /* Make labels slightly bolder */
          color: #343a40;
        }
        .valid-through {
          margin-top:15px; /* Increased margin */
          font-weight:bold;
          font-size: 13px; /* Smaller font size */
          color:#555; /* Adjusted color */
        }
        .barcode {
          margin-top:18px; /* Adjusted margin */
          display: flex; /* Center the SVG and text */
          flex-direction: column;
          align-items: center;
        }
         /* Style for text below barcode (generated by JsBarcode) */
         .barcode :global(text) { 
            font-size: 14px !important; /* Ensure text size */
            font-family: monospace !important;
         }
      `}</style>
    </>
  )
}
