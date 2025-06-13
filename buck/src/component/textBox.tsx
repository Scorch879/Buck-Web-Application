type TextBoxProps = {
  label: string;
};

export default function TextBox({ label }: TextBoxProps) {
  return (
    <div className="textBox">
      <label htmlFor="myTextbox">{label}:</label>
      <input type="text" id="myTextbox" name="myTextbox" />  
    </div>
  );
}