// pages/transcript.js
import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { parse } from 'cookie';
import { DateTime } from 'luxon'; // Use luxon for date formatting if needed, or standard Date

// --- fetchGoogleUser Helper (Same as working student-card/portal) ---
// Fetches fresh user data from Google Directory using Refresh Token
async function fetchGoogleUser(email) {
    console.log(`[fetchGoogleUser - Transcript] Attempting to get refresh token for: ${email}`);
    // Ensure all required ENV variables are set in Vercel
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
        console.error("[fetchGoogleUser - Transcript] Missing critical Google OAuth environment variables!");
        return null; // Cannot proceed without credentials
    }
    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
                grant_type: 'refresh_token'
            })
        });

        if (!tokenRes.ok) {
            const errorBody = await tokenRes.text();
            console.error(`[fetchGoogleUser - Transcript] Failed to refresh Google token: ${tokenRes.status}`, errorBody);
            return null;
        }

        const { access_token } = await tokenRes.json();
        console.log(`[fetchGoogleUser - Transcript] Got new access token. Fetching user data...`);

        const userRes = await fetch(
            `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(email)}?projection=full`,
            { headers: { Authorization: `Bearer ${access_token}` } }
        );

        if (!userRes.ok) {
            const errorBody = await userRes.text();
            console.error(`[fetchGoogleUser - Transcript] Failed to fetch Google user data: ${userRes.status}`, errorBody);
            return null;
        }
        console.log(`[fetchGoogleUser - Transcript] Successfully fetched user data.`);
        return await userRes.json();
    } catch (error) {
        console.error("[fetchGoogleUser - Transcript] Network or other error:", error);
        return null;
    }
}

// --- getServerSideProps (Fetches Google data, uses Cookie ID) ---
export async function getServerSideProps({ req }) {
    console.log("[getServerSideProps - Transcript] Starting...");
    const cookies = parse(req.headers.cookie || '');
    const oauthUsername = cookies.oauthUsername || null;
    const studentIdFromCookie = cookies.oauthStudentId || cookies.oauthUserId || null;
    const oauthFullNameFromCookie = cookies.oauthFullName || null;
    const trustLevel = parseInt(cookies.oauthTrustLevel || '0', 10);

    console.log("[getServerSideProps - Transcript] Cookies parsed:", cookies);

    if (!oauthUsername || trustLevel < 3) { // Keep auth check
        console.log("[getServerSideProps - Transcript] Redirecting: No username or insufficient trust.");
        return { redirect: { destination: '/', permanent: false } };
    }

    const rawDom = process.env.EMAIL_DOMAIN;
    const domain = rawDom && rawDom.startsWith('@') ? rawDom : '@' + (rawDom || 'kzxy.edu.kg');
    const studentEmail = oauthUsername.includes('@') ? oauthUsername : `${oauthUsername}${domain}`;

    console.log("[getServerSideProps - Transcript] Attempting fetchGoogleUser for:", studentEmail);
    const googleUser = await fetchGoogleUser(studentEmail);

    let fullName, emailToUse, finalStudentId, fetchError = null;

    if (!googleUser) {
        console.warn("[getServerSideProps - Transcript] fetchGoogleUser failed. Falling back to cookie data.");
        fetchError = "Could not refresh data from Google.";
        // --- Fallback to Cookie Data ---
        fullName = oauthFullNameFromCookie;
        emailToUse = studentEmail; // Use the email we know
        finalStudentId = studentIdFromCookie; // Must rely on cookie ID
    } else {
        console.log("[getServerSideProps - Transcript] Google user data fetched.");
        // --- Use Fetched Google Data (and cookie ID) ---
        fullName = googleUser.name ? `${googleUser.name.givenName || ''} ${googleUser.name.familyName || ''}`.trim() : oauthFullNameFromCookie; // Given + Family Name order
        emailToUse = googleUser.primaryEmail || studentEmail;
        // *** Prioritize Cookie ID for consistency ***
        finalStudentId = studentIdFromCookie || googleUser.id;
    }

    // Critical check for student ID
    if (!finalStudentId) {
        console.error("[getServerSideProps - Transcript] Error: Student ID is missing.");
        return { props: { error: "Student ID is missing, cannot generate transcript." } };
    }
     // Ensure Full Name isn't empty
     if (!fullName) {
        fullName = "Student"; // Generic fallback if both fail
     }


    console.log("[getServerSideProps - Transcript] Data prepared:", { fullName, emailToUse, finalStudentId });

    return {
        props: {
            // Pass the determined data
            fullName,
            studentEmail: emailToUse,
            studentId: finalStudentId,
            error: null, // No critical error if we got here
            fetchError // Pass fetch error message if fallback occurred
        }
    };
}


// --- Transcript Component ---
export default function Transcript({
    fullName,
    studentEmail, // Not displayed, but available if needed
    studentId,
    error,
    fetchError
}) {
    // State for data generated client-side based on studentId
    const [coursesData, setCoursesData] = useState({ selectedCourses: [], totalAttempted: 0, totalEarned: 0, totalQualityPoints: 0, gpa: '0.00' });
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [printDate, setPrintDate] = useState('');
    const [transcriptNo, setTranscriptNo] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // PDF generation state

    // Helper: Seeded random number generator
    const seededRandom = useCallback((seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }, []);

    // Helper: Generate random plausible Date of Birth
    const generateRandomDOB = useCallback((seed) => {
        const random = (offset) => seededRandom(seed + offset);
        const baseYear = 1998 + Math.floor(random(50) * 8); // Born ~1998-2005
        const birthMonth = Math.floor(random(51) * 12);
        const birthDay = 1 + Math.floor(random(52) * 27);
        const dob = new Date(baseYear, birthMonth, birthDay);
        return dob.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }, [seededRandom]);

    // Helper: Generate course data
    const generateCoursesData = useCallback((studentIdSeed) => {
        const coursePool = [ { id: 'CHN101', title: 'Elementary Chinese Speaking', credits: 3.0 }, { id: 'CHN102', title: 'Elementary Chinese Reading', credits: 3.0 }, { id: 'CHN201', title: 'Intermediate Chinese Speaking', credits: 3.0 }, { id: 'CHN202', title: 'Intermediate Chinese Reading', credits: 3.0 }, { id: 'CHN301', title: 'Advanced Chinese Grammar', credits: 3.0 }, { id: 'CUL100', title: 'Chinese Culture and Society', credits: 3.0 }, { id: 'CUL110', title: 'Chinese Festivals and Customs', credits: 2.0 }, { id: 'CUL200', title: 'Ancient Chinese Literature', credits: 3.0 }, { id: 'CUL210', title: 'Chinese Philosophy Introduction', credits: 3.0 }, { id: 'CUL220', title: 'Chinese Traditional Medicine', credits: 2.0 }, { id: 'CUL230', title: 'Chinese Martial Arts', credits: 1.0 }, { id: 'CUL240', title: 'Chinese Painting Basics', credits: 1.0 }, { id: 'CUL250', title: 'Chinese Folk Arts', credits: 1.0 }, { id: 'CUL260', title: 'Chinese Film and Media', credits: 3.0 }, { id: 'BUS300', title: 'Business Chinese', credits: 3.0 }, { id: 'HIS100', title: 'Chinese History Overview', credits: 3.0 }, { id: 'GEO100', title: 'Chinese Geography', credits: 3.0 }, { id: 'LAW100', title: 'Chinese Politics and Law', credits: 3.0 }, { id: 'ECO100', title: 'Chinese Economic Development', credits: 3.0 }, { id: 'LIT400', title: 'Modern Chinese Literature', credits: 3.0 }, ];
        const grades = ['A', 'A-', 'B+', 'B', 'C+', 'C', 'W'];
        const gpaPoints = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'C+': 2.3, 'C': 2.0, 'W': 0 };
        const seed = parseInt(studentIdSeed, 10) || Math.floor(Math.random() * 100000);
        const random = (offset) => seededRandom(seed + offset);
        const selectedCourses = [];
        let totalAttempted = 0, totalEarned = 0, totalQualityPoints = 0;
        const terms = []; const currentJsDate = new Date(); const currentYear = currentJsDate.getFullYear(); const currentMonth = currentJsDate.getMonth() + 1; const academicYearStartMonth = 9; let currentTermYear = currentYear; let currentTermSeason = (currentMonth >= academicYearStartMonth || currentMonth <= 2) ? 'Fall' : 'Spring'; if (currentMonth <= 2) currentTermYear--; const startYear = 2023; const startSeason = 'Fall'; for (let year = startYear; year <= currentTermYear; year++) { if (year === startYear && startSeason === 'Spring') {} else { terms.push(`Fall ${year}`); if (year < currentTermYear || (year === currentTermYear && currentTermSeason === 'Spring')) { terms.push(`Spring ${year + 1}`); } } if (year === currentTermYear && `Fall ${year}` === `${currentTermSeason} ${currentTermYear}`) break; if (year + 1 === currentTermYear && `Spring ${year + 1}` === `${currentTermSeason} ${currentTermYear}`) break; }
        const coursesPerTerm = 4; const usedIndices = new Set();
        terms.forEach((term, termIndex) => { const termCourses = []; let termAttempt = 0; while (termCourses.length < coursesPerTerm && usedIndices.size < coursePool.length && termAttempt < coursePool.length * 2) { const courseIdx = Math.floor(random(termIndex * 100 + termCourses.length * 5 + termAttempt) * coursePool.length); termAttempt++; if (!usedIndices.has(courseIdx)) { usedIndices.add(courseIdx); const course = coursePool[courseIdx]; const gradeRoll = random(termIndex * 100 + termCourses.length * 5 + 1); const gradeIdx = Math.floor(gradeRoll * (grades.length - (gradeRoll < 0.05 ? 0 : 1) )); const grade = grades[gradeIdx]; const credit = course.credits; const isEarned = grade !== 'W'; const qualityPts = isEarned ? (credit * (gpaPoints[grade] || 0)) : 0; termCourses.push({ term, courseId: course.id, title: course.title, grade, credit }); totalAttempted += credit; if (isEarned) { totalEarned += credit; totalQualityPoints += qualityPts; } } } if(termCourses.length > 0){ selectedCourses.push({ term, courses: termCourses }); } });
        const gpa = totalEarned > 0 ? (totalQualityPoints / totalEarned).toFixed(2) : '0.00';
        return { selectedCourses, totalAttempted, totalEarned, totalQualityPoints, gpa };
    }, [seededRandom]); // Dependency for useCallback

    // useEffect to generate data when studentId prop is available
    useEffect(() => {
        if (studentId && studentId !== 'ERRORID') {
            const dobSeed = parseInt(studentId, 10) || 12345;
            setDateOfBirth(generateRandomDOB(dobSeed));
            setCoursesData(generateCoursesData(studentId));

            // Set print date and transcript number
            const now = DateTime.now().setZone('America/New_York'); // Or use user's local timezone
            setPrintDate(now.toFormat('MMMM dd, yyyy'));
            setTranscriptNo(`Transcript No. ${now.toFormat('yyyyMMdd')}-${studentId}`);

        } else {
            // Handle case where studentId is missing or invalid
            setDateOfBirth('N/A');
            setCoursesData({ selectedCourses: [], totalAttempted: 0, totalEarned: 0, totalQualityPoints: 0, gpa: 'N/A' });
             setPrintDate('N/A');
             setTranscriptNo('Transcript No. N/A');
        }
    }, [studentId, generateRandomDOB, generateCoursesData]); // Rerun if studentId changes

    // PDF Generation Function
    const generatePDF = useCallback(() => {
        if (isGeneratingPdf) return; // Prevent multiple clicks
        setIsGeneratingPdf(true);
        console.log('Generating PDF...');
        const element = document.getElementById('transcript-content');
        const buttonContainer = document.querySelector('.pdf-button-container');

        if (!element) {
            console.error("Transcript content element not found!");
            setIsGeneratingPdf(false);
            return;
        }

        // Temporarily hide button
        if (buttonContainer) buttonContainer.style.visibility = 'hidden';

        const opt = {
            margin: 0.75,
            filename: `transcript_${studentId || 'student'}.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: -window.scrollY },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: 'avoid-all', before: '.coursework h2, .summary h2, .legend h2' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            console.log('PDF generated successfully.');
            setIsGeneratingPdf(false);
            if (buttonContainer) buttonContainer.style.visibility = 'visible'; // Show button again
        }).catch(err => {
            console.error('Error generating PDF:', err);
            alert('Could not generate PDF. Check console for details.');
            setIsGeneratingPdf(false);
            if (buttonContainer) buttonContainer.style.visibility = 'visible'; // Show button again
        });
    }, [studentId, isGeneratingPdf]); // Dependencies for useCallback


    // --- Render Logic ---
    if (error) {
        return ( /* Error display */ );
    }

    // Format student ID for display
    const displaySid = studentId && studentId !== 'ERRORID' ? String(studentId).padStart(6, '0') : 'N/A';

    return (
        <>
            <Head>
                <title>Transcript - Confucius Institute</title>
                <meta name="description" content="Confucius Institute Unofficial Academic Transcript" />
                {/* JsBarcode script needed for barcode generation */}
                {/* html2pdf script needed for PDF generation */}
                 {/* We load html2pdf via <Script> below for better control */}
            </Head>
            {/* Load JsBarcode - keep original */}
             <Script
                src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"
                strategy="afterInteractive" // Load after page is interactive
                onLoad={() => {
                    if (window.JsBarcode && document.getElementById('barcode-svg') && displaySid !== 'N/A') {
                        try {
                            window.JsBarcode('#barcode-svg', displaySid, {
                                format: 'CODE128', lineColor: '#000', width: 2, height: 50,
                                displayValue: true, textMargin: 5
                            });
                        } catch (e) { console.error("JsBarcode error:", e); }
                    } else if (displaySid === 'N/A') {
                        console.warn("Student ID missing, cannot generate barcode.");
                    }
                }}
                onError={(e) => { console.error("Failed to load JsBarcode script:", e); }}
            />
            {/* Load html2pdf.js */}
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
                strategy="lazyOnload" // Load when browser is idle
                onError={(e) => { console.error("Failed to load html2pdf script:", e); }}
            />


            <div className="transcript-container" id="transcript-content">
                <div className="watermark">OFFICIAL TRANSCRIPT</div>
                <div className="header">
                    <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Confucius Institute Logo" className="logo" />
                    <div className="school-info">
                        <h1>Confucius Institute at Kyrgyz National University</h1>
                        <p>66 Manas Avenue, Bishkek, 720033, Kyrgyz Republic</p>
                    </div>
                    <div className="transcript-title">Unofficial Academic Transcript</div>
                </div>
                <div className="meta-info">
                    <span id="transcript-no">{transcriptNo || 'Transcript No. ...'}</span>
                    <span id="print-date">{printDate ? `Date Issued: ${printDate}`: 'Date Issued: ...'}</span>
                </div>
                <div className="student-info">
                    <h2>Student Information</h2>
                    <div className="info-grid">
                        <div><strong>Student Name:</strong> <span id="student-name">{fullName || '...'}</span></div>
                        <div><strong>Student ID:</strong> <span id="student-id">{displaySid}</span></div>
                        <div><strong>Date of Birth:</strong> <span id="student-dob">{dateOfBirth || '...'}</span></div>
                        <div><strong>Program:</strong> <span>汉语学习项目</span></div> {/* Keep Chinese or change? */}
                        <div><strong>Enrollment Status:</strong> <span>Active</span></div>
                    </div>
                </div>
                <div className="coursework">
                    <h2>Institutional Coursework</h2>
                    <div id="course-tables">
                        {coursesData.selectedCourses.length === 0 && <p>No course data available.</p>}
                        {coursesData.selectedCourses.map((termData, termIdx) => (
                            <div className="term-courses" key={termIdx}>
                                <div className="term-header">{termData.term}</div>
                                <table className="course-table">
                                    <thead>
                                        <tr>
                                            <th>Course ID</th>
                                            <th>Course Title</th>
                                            <th>Grade</th>
                                            <th>Credits</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {termData.courses.map((course, courseIdx) => (
                                            <tr key={courseIdx}>
                                                <td>{course.courseId}</td>
                                                <td>{course.title}</td>
                                                <td>{course.grade}</td>
                                                <td>{course.credit.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="summary">
                    <h2>Academic Summary</h2>
                    <div className="info-grid">
                        <div><strong>Total Attempted Credits:</strong> <span id="total-attempted">{coursesData.totalAttempted.toFixed(1)}</span></div>
                        <div><strong>Total Earned Credits:</strong> <span id="total-earned">{coursesData.totalEarned.toFixed(1)}</span></div>
                        <div><strong>Total Quality Points:</strong> <span id="total-quality-points">{coursesData.totalQualityPoints.toFixed(2)}</span></div>
                        <div><strong>Cumulative GPA:</strong> <span id="cumulative-gpa">{coursesData.gpa}</span></div>
                    </div>
                </div>
                <div className="legend">
                     <h2>Grading System</h2>
                     {/* Legend Table */}
                     <table><thead><tr><th>Grade</th><th>Quality Points</th></tr></thead><tbody><tr><td>A</td><td>4.0</td></tr><tr><td>A-</td><td>3.7</td></tr><tr><td>B+</td><td>3.3</td></tr><tr><td>B</td><td>3.0</td></tr><tr><td>C+</td><td>2.3</td></tr><tr><td>C</td><td>2.0</td></tr><tr><td>W</td><td>Withdrawal (No point value)</td></tr></tbody></table>
                </div>
                <div className="footer">
                    <p>*** End of Unofficial Transcript ***</p>
                    <p>Page 1 of 1</p>
                </div>
                {/* Barcode SVG Element - Note the ID change */}
                <div className="barcode">
                     {displaySid !== 'N/A' ? (
                         <svg id="barcode-svg" width="200" height="70"></svg>
                     ) : (
                         <p style={{color: 'grey', fontSize: '12px', marginTop: '5px', height: '70px', display:'flex', alignItems:'center', justifyContent:'center'}}>Barcode N/A (ID Missing)</p>
                     )}
                 </div>
            </div>

            <div className="pdf-button-container">
                 {/* Disable button while generating */}
                <button onClick={generatePDF} disabled={isGeneratingPdf}> 
                    {isGeneratingPdf ? 'Generating PDF...' : 'Download Transcript (PDF)'}
                </button>
            </div>

            {/* Apply the exact CSS from the preview */}
            <style jsx>{`
                /* --- Paste the entire CSS block from transcript_preview.html here --- */
                body { background-color: #f0f2f5; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; }
                .transcript-container { background: #fff; padding: 40px 50px; margin: 20px auto; max-width: 8.5in; /* min-height: 11in; */ /* Remove min-height for natural flow */ box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; font-size: 10pt; line-height: 1.4; color: #333; }
                .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 72px; color: rgba(0, 86, 179, 0.08); font-weight: bold; pointer-events: none; user-select: none; white-space: nowrap; z-index: 0; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0056b3; padding-bottom: 15px; }
                .logo { height: 60px; margin-bottom: 5px; }
                .school-info h1 { margin: 5px 0; font-size: 16pt; font-weight: bold; color: #0056b3; }
                .school-info p { margin: 2px 0; font-size: 9pt; color: #555; }
                .transcript-title { font-size: 14pt; font-weight: bold; margin-top: 10px; margin-bottom: 20px; text-align: center; color: #333; }
                .meta-info { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 20px; color: #444; }
                .student-info { margin-bottom: 25px; padding: 15px; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; }
                .student-info h2, .coursework h2, .summary h2, .legend h2 { font-size: 12pt; font-weight: bold; color: #0056b3; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 0; margin-bottom: 10px; }
                .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 5px 20px; }
                .info-grid div { font-size: 10pt; }
                .info-grid strong { font-weight: 600; display: inline-block; min-width: 100px; }
                .coursework { margin-bottom: 20px; } /* Added margin */
                .course-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt; } /* Reduced margin */
                .course-table th, .course-table td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top;} /* Added vertical align */
                .course-table th { background-color: #e9ecef; font-weight: bold; text-align: center; }
                .course-table td:nth-child(1), .course-table td:nth-child(2), .course-table td:nth-child(4), .course-table td:nth-child(5) { text-align: center; white-space: nowrap; }
                .term-header { font-weight: bold; background-color: #f8f9fa; padding: 8px; margin-top: 15px; border-top: 1px solid #ccc; }
                .summary { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; }
                .summary .info-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
                .legend { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 9pt; }
                .legend table { width: auto; border-collapse: collapse; }
                .legend th, .legend td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
                .legend th { background-color: #f8f8f8; }
                .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #0056b3; font-size: 8pt; color: #666; text-align: center; }
                .footer p { margin: 3px 0; }
                .barcode { margin-top: 18px; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; } /* Added padding */
                .pdf-button-container { text-align: center; margin: 30px auto; max-width: 8.5in; }
                .pdf-button-container button { padding: 12px 25px; font-size: 11pt; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; transition: background-color 0.2s ease; }
                .pdf-button-container button:hover:not(:disabled) { background-color: #0056b3; }
                .pdf-button-container button:disabled { background-color: #cccccc; cursor: not-allowed; }

                /* Print specific styles */
                @media print { 
                    body { background-color: #fff; padding: 0; margin: 0; font-size: 10pt; } 
                    .pdf-button-container { display: none; } 
                    .transcript-container { box-shadow: none; margin: 0; max-width: 100%; padding: 0.5in; border: none; } 
                    .watermark { color: rgba(0, 86, 179, 0.08) !important; } /* Watermark for print */
                    .course-table th, .course-table td { font-size: 9pt; padding: 4px 6px;}
                    .info-grid div { font-size: 9.5pt; }
                    .legend { font-size: 8.5pt; }
                    .footer { font-size: 7.5pt; }
                     /* Attempt page break control for print */
                    .term-courses, .summary, .legend { page-break-inside: avoid; }
                    .coursework h2, .summary h2, .legend h2 { page-break-before: auto; } /* Let browser decide */
                }
            `}</style>
        </>
    );
}
