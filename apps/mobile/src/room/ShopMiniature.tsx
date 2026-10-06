import Svg, { Path, Rect, Circle, Ellipse, G } from "react-native-svg";
import type { RoomObjectKind } from "./roomObjects";
/** Local silhouettes: native SVG only, no world capture, assets or extra Canvas. */
export const SHOP_MINIATURES: Record<RoomObjectKind, string> = {
  shelf: "shelves", desk: "table-drawers", chair: "upholstered-armchair", case: "glass-shelves",
  rug: "oval-rug", lamp: "shade-stand", plant: "white-pot-pink-flowers", "table-lamp": "compact-table-lamp", "large-plant": "arching-palm-fronds", archive: "storage-box",
  "wall-frame": "picture-frame", "photo-string": "sagging-cards",
};
export function ShopMiniature({ kind }: { kind: RoomObjectKind }) {
  const ink = "#795b64", wood = "#c8a386", paper = "#f0ded7";
  return <Svg width={48} height={48} viewBox="0 0 48 48" accessibilityLabel={SHOP_MINIATURES[kind]}>
    {kind === "shelf" || kind === "case" ? <>
      <Rect x={10} y={5} width={28} height={38} rx={2} fill={kind === "case" ? "#dce9e8" : wood} stroke={ink} strokeWidth={2} />
      <Path d="M12 16H36 M12 27H36 M12 38H36" stroke={ink} strokeWidth={2} />
      {kind === "case" ? <Path d="M17 9L30 20 M17 23L30 34" stroke="#fff" strokeWidth={2} /> : null}
    </> : null}
    {kind === "desk" ? <><Rect x={4} y={16} width={40} height={5} rx={1} fill={wood} stroke={ink} /><Path d="M8 21V42 M40 21V42" stroke={ink} strokeWidth={3} /><Rect x={27} y={22} width={12} height={15} fill={wood} stroke={ink} /><Path d="M29 27H37 M29 32H37" stroke={ink} /></> : null}
    {kind === "chair" ? <><Rect x={9} y={5} width={30} height={25} rx={7} fill={wood} stroke={ink} /><Rect x={8} y={26} width={32} height={12} rx={4} fill={paper} stroke={ink} /><Rect x={4} y={18} width={8} height={20} rx={4} fill={wood} stroke={ink} /><Rect x={36} y={18} width={8} height={20} rx={4} fill={wood} stroke={ink} /><Path d="M11 38V43 M37 38V43" stroke={ink} strokeWidth={3} /></> : null}
    {kind === "rug" ? <><Ellipse cx={24} cy={27} rx={21} ry={12} fill="#c891a4" stroke={ink} /><Ellipse cx={24} cy={27} rx={16} ry={8} fill="none" stroke={paper} /></> : null}
    {kind === "lamp" ? <><Path d="M24 17V40 M16 42H32" stroke={ink} strokeWidth={3} /><Path d="M16 6H32L37 19H11Z" fill={paper} stroke={ink} /></> : null}
    {kind === "table-lamp" ? <><Path d="M24 24V38 M15 40H33" stroke={ink} strokeWidth={3} /><Path d="M16 12H32L37 27H11Z" fill={paper} stroke={ink} /></> : null}
    {kind === "plant" ? <><Path d="M24 34V14 M21 30L14 19 M26 28L34 17" stroke="#5a7860" strokeWidth={2} /><Ellipse cx={19} cy={27} rx={5} ry={2} fill="#668a68" />{[[24,13],[13,18],[34,16]].map(([x,y])=><G key={x}>{[0,1,2,3,4].map(i=><Circle key={i} cx={x+Math.cos(i*1.256)*3} cy={y+Math.sin(i*1.256)*3} r={3} fill="#e6bac7" />)}<Circle cx={x} cy={y} r={2} fill="#e7c985" /></G>)}<Path d="M15 32H33L30 44H18Z" fill="#fff7ef" stroke={ink} /></> : null}
    {kind === "large-plant" ? <><Path d="M24 35Q9 4 3 20 M24 35Q17 1 12 7 M24 35Q31 0 36 8 M24 35Q40 9 45 22" fill="none" stroke="#587451" strokeWidth={2} />{[8,15,24,33,40].map((x,i)=><Path key={x} d={`M${x} ${10+i%2*5}l-5 7 M${x} ${10+i%2*5}l5 7 M${x} ${15+i%2*5}l-5 7 M${x} ${15+i%2*5}l5 7`} stroke="#6d9264" strokeWidth={1.5} />)}<Path d="M16 33H32L29 44H19Z" fill={paper} stroke={ink} /></> : null}
    {kind === "archive" ? <><Rect x={5} y={17} width={38} height={24} fill={wood} stroke={ink} /><Path d="M4 17L9 10H39L44 17Z" fill={paper} stroke={ink} /><Rect x={18} y={25} width={12} height={6} fill={paper} stroke={ink} /></> : null}
    {kind === "wall-frame" ? <><Rect x={9} y={5} width={30} height={38} fill={wood} stroke={ink} /><Rect x={13} y={9} width={22} height={30} fill={paper} /><Path d="M15 33L23 21L33 33Z" fill="#a3b8a0" /><Circle cx={28} cy={17} r={3} fill="#d8b77e" /></> : null}
    {kind === "photo-string" ? <><Path d="M3 10Q24 22 45 10" fill="none" stroke={ink} strokeWidth={1.5} />{[5,13,21,29,37].map((x,i) => <Rect key={x} x={x} y={15 + (i === 2 ? 4 : i === 1 || i === 3 ? 3 : 0)} width={6} height={11} fill={paper} stroke={ink} />)}</> : null}
  </Svg>;
}
