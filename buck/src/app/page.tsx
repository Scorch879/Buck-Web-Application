import Image from "next/image";
import styles from "../component/page.module.css";
import {Header,Footer} from '../component/HeaderFooter'
import GetStartedButton from "../component/GetStartedButton";

export default function Home() {
  return (
    <>
    <div className="mainStrip">
      <div className="welcomeSign">
        <div className="buckmsg">
          <p id="name">Buck</p>
          <div className="smoothLine"></div>
          <p id="desc">The Budget Tracker</p>
        </div>
          <div className="buckmascot"></div>
      </div>
      <div className="welcomeMsg">  
        <p>Hello World</p>
      </div>
    <GetStartedButton />
    </div>
      
    </>
  );
}
