import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  otpForm: FormGroup;
  showOTP: boolean = false;
  errorMessage: string = '';
  emailVerificationMessage: string = '';
  displayTime: string = '';
  isRedText: boolean = false;
  remainingTime: number = 120;
  emailNotVerified: boolean = false;
  timer: any;
  isButtonDisabled = false;

  constructor(private formBuilder: FormBuilder, private http: HttpClient, private router: Router, private snackBar: MatSnackBar) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      rememberMe: [false]
    });

    this.otpForm = this.formBuilder.group({
      otp: ['']
    });
  }

  ngOnInit() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    console.log('Token:', token);
    if (token) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Initialize the otpForm without validators initially
    this.otpForm = this.formBuilder.group({
      otp: ['']
    });
  }

  onRememberMeChange(event: any) {
    const rememberMe = event.checked;
    this.loginForm.get('rememberMe')?.setValue(rememberMe);
  }

  onSubmit() {
    if (this.loginForm.valid && !this.showOTP) {
      this.isButtonDisabled = true;
      const email = this.loginForm.value.email;
      const password = this.loginForm.value.password;
      const rememberMe = this.loginForm.value.rememberMe;

      const credentials = {
        email: email,
        password: password,
        rememberMe: rememberMe
      };

      this.http.post('http://localhost:3000/login', credentials, { withCredentials: true })
        .pipe(
          catchError(error => {
            console.error('Login failed');
            console.error(error);
            if (error.status === 400) {
              const errorMessage = error.error;
              if (errorMessage === 'User not found') {
                this.openSnackBar('User not found. Please SignUp first.', 5000, 'error-message');
              } else if (errorMessage === 'Email address not verified') {
                this.openSnackBar('Email address not verified.', 4000, 'warning-message');
              } else if (errorMessage === 'Invalid password') {
                this.openSnackBar('Invalid password.', 4000, 'error-message');
              } else if (errorMessage === 'You are using an old password.') {
                this.openSnackBar('You are using an old password.', 4000, 'warning-message');
              }
              this.isButtonDisabled = false;
            }
            // throw error;
            return of(null);
          })
        )
        .subscribe((response: any) => {
          if (response && response.message === 'An OTP has been sent to your email') {
            this.showOTP = true;
            this.openSnackBar('An OTP has been sent to your email', 4000, 'success-message');
            this.toggleOTPField();
            this.startTimer();
            this.otpForm.reset();
            this.emailVerificationMessage = '';
            this.isButtonDisabled = false;
          } else if (response && response.message === 'Login successful') {
            // console.log("Login successful");
            // console.log(response.token);
            localStorage.setItem('token', response.token);
            this.router.navigate(['/dashboard']);
          }
        });
    } else if (this.loginForm.valid && this.showOTP) {
      this.onOtpSubmit();
    }
  }

  getOtpControl() {
    return this.otpForm.get('otp');
  }

  onOtpSubmit() {
    if (this.otpForm.valid) {
      let otp = this.otpForm.value.otp;
      otp = otp.toString();

      this.otpForm.reset();
      this.showOTP = false;
      this.toggleOTPField();
      clearInterval(this.timer);

      const otpCredentials = {
        otp: otp
      };

      this.http.post('http://localhost:3000/otp', otpCredentials, { withCredentials: true })
        .pipe(
          catchError(error => {
            console.error('OTP verification failed');
            console.error(error);
            this.errorMessage = 'OTP verification failed';
            // throw error;
            return of(null);
          })
        )
        .subscribe((response: any) => {
          if (response && response.token) {
            console.log('OTP verification successful');
            console.log(response);
            localStorage.setItem('token', response.token);
            this.router.navigate(['/dashboard']);
          } else {
            console.log('OTP verification failed');
            this.errorMessage = 'OTP verification failed';
          }
        });
      this.isButtonDisabled = false;
    }
  }

  openSnackBar(message: string, duration: number, messageType: string): void {
    this.snackBar.open(message, 'Close', {
      duration: duration,
      panelClass: [messageType]
    });
  }

  toggleOTPField() {
    const otpControl = this.otpForm.get('otp');
    if (this.showOTP) {
      otpControl?.setValidators([Validators.required, Validators.minLength(6), Validators.maxLength(10)]);
    } else {
      otpControl?.clearValidators();
    }
    otpControl?.updateValueAndValidity();
  }

  startTimer() {
    this.remainingTime = 120;
    this.updateDisplayTime();
    this.timer = setInterval(() => {
      if (this.remainingTime > 0) {
        this.remainingTime--;
        this.updateDisplayTime();
        this.checkRedText();
      } else {
        clearInterval(this.timer);
      }
    }, 1000);
  }

  updateDisplayTime() {
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    this.displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.checkRedText();
  }

  checkRedText() {
    this.isRedText = this.remainingTime <= 10;
  }
}
