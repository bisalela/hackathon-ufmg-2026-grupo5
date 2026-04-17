const boxes = [
  { cls: "float-box",        w: 48,  h: 48,  top: "11%", left: "5%",  anim: "boxFloat1", dur: "17s", delay: "0s"   },
  { cls: "float-box",        w: 96,  h: 30,  top: "7%",  left: "70%", anim: "boxFloat2", dur: "21s", delay: "3.5s" },
  { cls: "float-box-filled", w: 30,  h: 80,  top: "38%", left: "90%", anim: "boxFloat3", dur: "19s", delay: "1.2s" },
  { cls: "float-box",        w: 60,  h: 60,  top: "70%", left: "80%", anim: "boxFloat1", dur: "23s", delay: "5s"   },
  { cls: "float-box-filled", w: 80,  h: 26,  top: "58%", left: "2%",  anim: "boxFloat2", dur: "18s", delay: "2s"   },
  { cls: "float-box",        w: 38,  h: 38,  top: "83%", left: "44%", anim: "boxFloat3", dur: "25s", delay: "4.5s" },
  { cls: "float-box",        w: 22,  h: 64,  top: "28%", left: "50%", anim: "boxFloat1", dur: "20s", delay: "6.5s" },
  { cls: "float-box-filled", w: 52,  h: 20,  top: "48%", left: "30%", anim: "boxFloat2", dur: "16s", delay: "8s"   },
];

export default function FloatingBoxes({ opacity = 1 }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
    >
      {boxes.map((box, i) => (
        <div
          key={i}
          className={box.cls}
          style={{
            width: box.w,
            height: box.h,
            top: box.top,
            left: box.left,
            animation: `${box.anim} ${box.dur} ease-in-out infinite`,
            animationDelay: box.delay,
          }}
        />
      ))}
    </div>
  );
}
