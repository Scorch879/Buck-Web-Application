import { Header, Footer } from '../../component/HeaderFooter';

export default function SignUp(){
    return(
        <>
        <Header/>
            <div className="mainStrip">
                <div className="darken animate-fade-bg">
                    <div className="signupContainer animate-fade-in">   
                        {/* Sign up form goes here */}
                    </div>
                </div>
            </div>
        <Footer/>
        </>
    );
}