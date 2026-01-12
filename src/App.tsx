import { useEffect, useState } from "react";
import { Plot } from "./Plot";

type ViewDims = { width: number; height: number };

const getDims = (): ViewDims => {
  const clientWidth = document.documentElement.clientWidth || window.innerWidth;
  const clientHeight = document.documentElement.clientHeight || window.innerHeight;
  return {
    width: clientWidth,
    height: Math.max(300, Math.floor(clientHeight * 0.7)),
  };
};

function App() {
  const [dims, setDims] = useState<ViewDims>(getDims());

  useEffect(() => {
    const handleResize = () => setDims(getDims());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: "100vw", overflow: "hidden" }}>
      <Plot width={dims.width} height={dims.height} />
    </div>
  );
}

export default App;
