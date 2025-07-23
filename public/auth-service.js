// Initialize Firestore
const db = firebase.firestore();

// Function to check if user is authorized using Firestore
async function isUserAuthorized(email) {
    try {
        const docRef = db.collection('authorized_users').doc(email.toLowerCase());
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            return data.authorized === "true";
        } else {
            console.log(`User ${email} not found in authorized users`);
            return false;
        }
    } catch (error) {
        console.error('Error checking user authorization:', error);
        return false;
    }
}

// Function to handle auth state changes with Firestore check
async function handleAuthStateChange(user, onAuthorized, onUnauthorized) {
    if (user) {
        console.log('User signed in:', user.email);
        
        // Show loading while checking authorization
        const loadingDiv = document.getElementById('loadingAuth');
        if (loadingDiv) {
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = '<div class="loading-indicator"></div><p>Checking authorization...</p>';
        }
        
        const authorized = await isUserAuthorized(user.email);
        
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        if (authorized) {
            console.log('User is authorized');
            onAuthorized(user);
        } else {
            console.log('User is not authorized');
            alert(`Access denied. Your account (${user.email}) is not authorized to access this system. Please contact an administrator.`);
            firebase.auth().signOut();
            onUnauthorized();
        }
    } else {
        console.log('User signed out');
        onUnauthorized();
    }
}