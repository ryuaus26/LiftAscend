/*  
   Austin Ryu 1/28/2025  
   
   This JavaScript file handles user interactions, including password reset,  
   authentication, and UI updates. It listens for form submissions,  
   sends password reset emails, and provides feedback based on  
   the success or failure of the operation.  
*/


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
