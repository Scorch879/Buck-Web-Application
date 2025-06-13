import { Header, Footer } from '../../component/HeaderFooter';
import TextBox from '@/component/textBox';

export default function SignUp(){
    return(
        <>
        <Header/>
            <div className="mainStrip">
                <div className="darken animate-fade-bg">
                    <div className="signupContainer animate-fade-in">   
                        <div id="buckCircle"></div>
                        <p>Create Account</p>
                        <TextBox label='Username'/>
                        <TextBox label='Password'/>
                        <TextBox label='Confirm Password'/>
                        <TextBox label='Email'/>
                        <button>Sign up</button>
                    </div>                  
                </div>
            </div>
        <Footer/>
        </>
    );
}