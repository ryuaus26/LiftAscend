function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    
    if (!validate_email(email) || !validate_password(password)) {
        alert('Email or Password is invalid!');
        return;
    }
  
    auth.signInWithEmailAndPassword(email, password)
        .then(function(userCredential) {
            const user = userCredential.user;
            const database_ref = database.ref();
  
            const user_data = {
                last_login: Date.now()
            };
  
            database_ref.child('users/' + user.uid).update(user_data);
            alert('User Logged In!');
            window.location.hash = 'loggedin';
            document.getElementById("home").style.display = "none";
            document.getElementById("loggedin").style.display = "block";
        })
        .catch(function(error) {
            const error_message = error.message;
            alert(error_message);
        });
  }
  

  async function register() {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const full_name = document.getElementById('full_name').value;
      
      if (!validate_email(email) || !validate_password(password)) {
          alert('Email or Password is invalid!');
          return;
      }
    
      if (!validate_field(full_name)) {
          alert('Full Name is invalid!');
          return;
      }
      
      try {
          const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
          const user = userCredential.user;
          const lastFiveChars = user.uid.slice(-5);
          const user_data = {
              email: email,
              full_name: full_name + " " + lastFiveChars,
              name: full_name,
              last_login: Date.now(),
          };
  
          // Save the user data directly under the user's UID in the database
          await firebase.database().ref('users/' + user.uid).set(user_data);
          
          alert('User Created!');
          
      } catch (error) {
          console.error("Error during registration:", error);
          alert(error.message);
      }
  }


  
  
  // Validate Functions
  function validate_email(email) {
    const expression = /^[^@]+@\w+(\.\w+)+\w$/;
    return expression.test(email);
  }
  
  function validate_password(password) {
    return password.length >= 6;
  }
  
  function validate_field(field) {
    return field != null && field.length > 0;
  }