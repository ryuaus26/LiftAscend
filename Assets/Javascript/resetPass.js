document.getElementById('reset-password-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form submission
    
    const email = document.getElementById('reset-email').value;
   
    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert('Password reset email sent! Check your inbox.');
        })
        .catch((error) => {
            console.error("Error sending password reset email:", error);
            alert('Failed to send password reset email. Please check your email address.');
        });
});
