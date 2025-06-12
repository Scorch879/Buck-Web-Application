import Image from "next/image";
import styles from "../component/page.module.css";
import {Header,Footer} from '../component/HeaderFooter'


export default function Home() {
  return (
    <div className="mainStrip">
      <div className="welcomeSign">
      <img src="./BuckSign.png" alt="welcome Sign" id="sign"></img>
      </div>
      <div className="welcomeMsg">

      </div>
    </div>
  );
}
