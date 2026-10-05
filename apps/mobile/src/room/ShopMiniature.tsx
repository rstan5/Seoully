import Svg, { Path, Rect, Circle, Ellipse } from "react-native-svg";
import type { RoomObjectKind } from "./roomObjects";
/** Local silhouettes: native SVG only, no world capture, assets or extra Canvas. */
export const SHOP_MINIATURES: Record<RoomObjectKind, string> = {
  shelf: "shelves", desk: "table-drawers", chair: "upholstered-armchair", case: "glass-shelves",
  rug: "oval-rug", lamp: "shade-stand", plant: "leaves-pot", archive: "storage-box",
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
    {kind === "plant" ? <><Circle cx={24} cy={19} r={12} fill="#6a876e" /><Circle cx={15} cy={23} r={7} fill="#5a775e" /><Path d="M15 30H33L30 43H18Z" fill={wood} stroke={ink} /></> : null}
    {kind === "archive" ? <><Rect x={5} y={17} width={38} height={24} fill={wood} stroke={ink} /><Path d="M4 17L9 10H39L44 17Z" fill={paper} stroke={ink} /><Rect x={18} y={25} width={12} height={6} fill={paper} stroke={ink} /></> : null}
    {kind === "wall-frame" ? <><Rect x={9} y={5} width={30} height={38} fill={wood} stroke={ink} /><Rect x={13} y={9} width={22} height={30} fill={paper} /><Path d="M15 33L23 21L33 33Z" fill="#a3b8a0" /><Circle cx={28} cy={17} r={3} fill="#d8b77e" /></> : null}
    {kind === "photo-string" ? <><Path d="M3 10Q24 22 45 10" fill="none" stroke={ink} strokeWidth={1.5} />{[5,13,21,29,37].map((x,i) => <Rect key={x} x={x} y={15 + (i === 2 ? 4 : i === 1 || i === 3 ? 3 : 0)} width={6} height={11} fill={paper} stroke={ink} />)}</> : null}
  </Svg>;
}
