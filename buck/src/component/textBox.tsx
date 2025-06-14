type TextBoxProps = {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function TextBox({ label, id, type = "text", value, onChange}: TextBoxProps) {
  return (
    <div className="textBox">
      <label htmlFor={id}>{label}:</label>
      <input 
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={onChange}
      />  
    </div>
  );
}