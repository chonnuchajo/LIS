import { useState } from "react";
import { Thermometer, Droplets, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { validateEnvRoomConfig, type EnvRoom, type EnvRoomConfigInput } from "@/lib/dailyCheckEnv";

const MANUAL = "__manual__"; // boardId = "" (no sensor)
const CUSTOM = "__custom__"; // reveal free-text board id input

interface Props {
  room: EnvRoom;                 // merged current values (label + current boardId/thresholds)
  detectedBoards: string[];      // board ids seen live from getLiveTempHum
  saving: boolean;
  onSave: (slug: EnvRoom["slug"], input: EnvRoomConfigInput) => void;
}

const EnvRoomConfigCard = ({ room, detectedBoards, saving, onSave }: Props) => {
  // Board options = detected boards ∪ the room's current saved board.
  const options = Array.from(
    new Set([...detectedBoards, ...(room.boardId ? [room.boardId] : [])]),
  );

  // Initial select value: MANUAL when no board; otherwise the board id itself.
  const [boardSel, setBoardSel] = useState<string>(room.boardId ? room.boardId : MANUAL);
  const [customBoard, setCustomBoard] = useState<string>("");
  const [tempMin, setTempMin] = useState<string>(String(room.tempMin));
  const [tempMax, setTempMax] = useState<string>(String(room.tempMax));
  const [humidityMax, setHumidityMax] = useState<string>(String(room.humidityMax));

  const effectiveBoardId =
    boardSel === MANUAL ? "" : boardSel === CUSTOM ? customBoard.trim() : boardSel;

  const draft: EnvRoomConfigInput = {
    boardId: effectiveBoardId,
    tempMin: Number(tempMin),
    tempMax: Number(tempMax),
    humidityMax: Number(humidityMax),
  };
  const error = validateEnvRoomConfig(draft);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-primary" />
          {room.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Board selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> เซนเซอร์ (board)
          </label>
          <Select value={boardSel} onValueChange={setBoardSel}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="เลือก board" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MANUAL}>— ไม่มี (กรอกมือ)</SelectItem>
              {options.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
              <SelectItem value={CUSTOM}>พิมพ์เอง…</SelectItem>
            </SelectContent>
          </Select>
          {boardSel === CUSTOM && (
            <Input
              className="mt-2 h-9 text-sm"
              placeholder="board id (เช่น BALANCE-01)"
              value={customBoard}
              onChange={(e) => setCustomBoard(e.target.value)}
            />
          )}
        </div>

        {/* Thresholds */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">อุณหภูมิต่ำสุด (°C)</label>
            <Input type="number" step="0.1" value={tempMin} onChange={(e) => setTempMin(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">อุณหภูมิสูงสุด (°C)</label>
            <Input type="number" step="0.1" value={tempMax} onChange={(e) => setTempMax(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> ความชื้นสูงสุด (%RH)
            </label>
            <Input type="number" step="0.1" value={humidityMax} onChange={(e) => setHumidityMax(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error.message}</p>}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving || !!error}
            onClick={() => onSave(room.slug, draft)}
          >
            บันทึก
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnvRoomConfigCard;
