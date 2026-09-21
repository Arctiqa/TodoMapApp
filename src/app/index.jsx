import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  PanResponder,
  StatusBar,
  Image,
  BackHandler,
} from "react-native";
// Требует: expo install expo-image-picker 
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";

let DOM_DEFAULT_BG = null;
let MAP_DEFAULT_BG = null;
try {
  DOM_DEFAULT_BG = require("../assets/backgrounds/dom-bg.jpg");
} catch (e) {
  // файла ещё нет
}
try {
  MAP_DEFAULT_BG = require("../assets/backgrounds/map-bg.jpg");
} catch (e) {
  // файла ещё нет
}

function resolveImageSource(img) {
  if (!img) return null;
  return typeof img === "number" ? img : { uri: img };
}

let INK = "#3B2F2F";
let PAPER = "#FFFDF7";
let CARD = "#FFF7E8";
let BAR_BG = "#DCEFF6";

const GREEN = "#2ECC71";
const BLUE = "#2F6FDE";

const THEMES = {
  light: { label: "☀️ Светлая", ink: "#3B2F2F", paper: "#FFFDF7", card: "#FFF7E8", bar: "#DCEFF6" },
  dark: { label: "🌙 Тёмная", ink: "#EDE3D3", paper: "#1E1A16", card: "#2A2521", bar: "#2E2A26" },
  blue: { label: "🔵 Синяя", ink: "#1F3A52", paper: "#EAF3FB", card: "#D9EBFA", bar: "#BFE0F5" },
  red: { label: "🔴 Красная", ink: "#4A1F1F", paper: "#FBEFEF", card: "#F8DEDE", bar: "#F3C5C5" },
  green: { label: "🟢 Зелёная", ink: "#1F3B1F", paper: "#EFF8EF", card: "#DFF3DF", bar: "#C5E8C5" },
  yellow: { label: "🟡 Жёлтая", ink: "#4A3E12", paper: "#FBF8E8", card: "#F7F0C8", bar: "#F0E29A" },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.light;
  INK = t.ink;
  PAPER = t.paper;
  CARD = t.card;
  BAR_BG = t.bar;
}

const PALETTE = ["#FF4B3E", "#00C9A7", "#FFC300", "#8B2FC9", "#2D6CDF", "#FF6F00", "#00A8E8", "#E6399B"];

const THEME_BG = {
  terrain: "#A3D584",
  home: "#EAD6F2",
  city: "#A9C5E3",
};

let uid = Date.now() * 1000;
const nextId = () => uid++;
const todayStr = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function toDate(due) {
  if (!due) return null;
  if (due.kind === "duration" && due.target) return new Date(due.target);
  if (due.date && due.time) return new Date(`${due.date}T${due.time}`);
  if (due.date) return new Date(`${due.date}T23:59:00`);
  if (due.time) {
    const [h, m] = due.time.split(":");
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d;
  }
  return null;
}

function formatRemaining(due) {
  if (!due) return "без срока";
  if (due.kind === "duration") {
    if (!due.target) return "без срока";
    const diffMs = due.target - Date.now();
    if (diffMs <= 0) return "⏰ истекло";
    if (diffMs < 86400000) {
      // последний день — считаем по часам/минутам
      const diffMin = Math.round(diffMs / 60000);
      if (diffMin < 60) return `через ${diffMin} мин`;
      const diffH = Math.round(diffMin / 60);
      return `через ${diffH} ч`;
    }
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays === 1 ? "через 1 день" : `через ${diffDays} дн.`;
  }
  const d = toDate(due);
  if (!d) return "без срока";
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return "⏰ истекло";
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `через ${diffMin} мин`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `через ${diffH} ч`;
  const diffD = Math.round(diffH / 24);
  return `через ${diffD} дн.`;
}

function isTaskExpired(task) {
  if (!task || task.done || !task.due) return false;
  const d = toDate(task.due);
  if (!d) return false;
  return d.getTime() - Date.now() <= 0;
}

function shortLabel(text) {
  if (!text) return "";
  return text.length > 18 ? text.slice(0, 17) + "…" : text;
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const NOW = Date.now();

const PLACE_HINTS = [
  {
    layer: "🏠 Дом / Жильё",
    type: "home",
    items: [
      { emoji: "🏠", name: "Дом" },
      { emoji: "👵", name: "Дом бабушки" },
      { emoji: "🗺", name: "Дом друга" },
      { emoji: "👨‍👩‍👧", name: "Родители" },
      { emoji: "🏚", name: "Дача" },
    ],
  },
  {
    layer: "💪 Спорт / Тело",
    type: "sport",
    items: [
      { emoji: "🏋️", name: "Тренажёрный зал" },
      { emoji: "🏊", name: "Бассейн" },
      { emoji: "🧘", name: "Йога" },
      { emoji: "🧗", name: "Скалодром" },
      { emoji: "🏟", name: "Стадион" },
    ],
  },
  {
    layer: "📚 Учёба / Навыки",
    type: "study",
    items: [
      { emoji: "🎓", name: "Университет" },
      { emoji: "🎓", name: "Колледж" },
      { emoji: "📖", name: "Библиотека" },
      { emoji: "🎨", name: "Художественная школа" },
      { emoji: "🎵", name: "Музыкальная школа" },
      { emoji: "💻", name: "Курсы" },
      { emoji: "🗣", name: "Языковая школа" },
      { emoji: "🔬", name: "Лаборатория" },
      { emoji: "🔧", name: "Мастерская" },
    ],
  },
  {
    layer: "💼 Работа / Дело",
    type: "work",
    items: [
      { emoji: "🏢", name: "Офис" },
      { emoji: "🏭", name: "Завод" },
      { emoji: "🏬", name: "Магазин" },
      { emoji: "🧑‍🍳", name: "Кафе" },
      { emoji: "🍽", name: "Ресторан" },
      { emoji: "🏗", name: "Стройка" },
      { emoji: "🖥", name: "Коворкинг" },
    ],
  },
  {
    layer: "🎉 События / Культура",
    type: "event",
    items: [
      { emoji: "🎭", name: "Театр" },
      { emoji: "🎬", name: "Кинотеатр" },
      { emoji: "🖼", name: "Выставка" },
      { emoji: "🎲", name: "Настольный клуб" },
      { emoji: "🎮", name: "Киберспортивный турнир" },
      { emoji: "🎠", name: "Ярмарка" },
      { emoji: "🎓", name: "Форум" },
      { emoji: "🎪", name: "Фестиваль" },
      { emoji: "🎤", name: "Концерт" },
    ],
  },
  {
    layer: "🌍 Мир / Путешествия",
    type: "travel",
    items: [
      { emoji: "🗺", name: "Город" },
      { emoji: "🏘", name: "Деревня" },
      { emoji: "🌊", name: "Море" },
      { emoji: "🏔", name: "Горы" },
      { emoji: "🌲", name: "Лес" },
      { emoji: "💧", name: "Байкал" },
    ],
  },
  {
    layer: "❤️ Помощь / Смысл",
    type: "help",
    items: [
      { emoji: "🏥", name: "Больница" },
      { emoji: "🐕", name: "Приют для животных" },
      { emoji: "🍲", name: "Благотворительная кухня" },
      { emoji: "📦", name: "Волонтёрский центр" },
      { emoji: "🌱", name: "Экологический проект" },
      { emoji: "🩸", name: "Донорский пункт" },
      { emoji: "🏫", name: "Школа-интернат" },
      { emoji: "🧓", name: "Дом престарелых" },
    ],
  },
];

// Плоские, конкретные подсказки дел — привязаны к типу места (marker.type).

const TASK_HINTS = {
  home: [
    "Поклеить обои", "Покрасить стены", "Поменять пол", "Починить мебель", "Собрать мебель",
    "Повесить полки", "Заменить смеситель", "Утеплить окна",
    "Убрать комнату", "Разобрать шкаф", "Выбросить хлам", "Помыть окна", "Пропылесосить",
    "Разобрать кладовку", "Помыть холодильник",
    "Приготовить ужин", "Испечь пирог", "Закрутить банки", "Приготовить на неделю",
    "Освоить новый рецепт", "Сделать заготовки",
    "Разобрать одежду", "Постирать", "Погладить", "Отдать ненужное", "Купить новое", "Сменить сезонное",
    "Полить цветы", "Покормить кота", "Починить кран", "Заменить лампочку",
    "Вызвать мастера", "Оплатить счета",
  ],
  sport: [
    "Начать ходить", "Составить программу", "Нанять тренера", "Сделать замеры",
    "Купить форму", "Записаться в зал",
    "Сбросить вес", "Набрать массу", "Пробежка",
	"Выступить на соревновании",
  ],
  study: [
    "Записаться на курс", "Купить учебник", "Составить расписание", "Сдать экзамен",
    "Защитить диплом", "Посещать лекции",
    "Выучить язык", "Освоить программу", "Научиться рисовать", "Научиться играть",
    "Сдать на права", "Пройти практику",
  ],
  work: [
    "Найти работу", "Сменить работу", "Пройти собеседование", "Взять проект",
    "Попросить повышение", "Составить резюме",
    "Открыть бизнес", "Найти клиентов", "Зарегистрировать ИП", "Сделать сайт",
    "Нанять сотрудника", "Выйти на доход",
  ],
  event: [
    "Купить билет", "Позвать друга", "Взять выходной", "Подготовить костюм",
    "Добраться", "Сделать фото",
    "Познакомиться", "Выступить", "Записаться в волонтёры", "Купить сувенир",
    "Попробовать еду",
  ],
  travel: [
    "Выбрать место", "Купить билет", "Забронировать жильё", "Собрать чемодан",
    "Оформить визу", "Сделать страховку", "Обменять деньги", "Составить маршрут",
    "Сходить на экскурсию", "Попробовать местную еду", "Сфотографировать",
    "Купить сувенир", "Познакомиться с местными",
  ],
  help: [
    "Сдать кровь", "Отвезти в больницу", "Помочь с ремонтом", "Отдать вещи",
    "Перевести деньги", "Купить продукты",
    "Навестить", "Позвонить", "Выслушать", "Помочь по дому", "Организовать сбор",
  ],
  general: [
    "Составить план", "Назначить дату", "Купить необходимое", "Найти информацию",
    "Записаться",
    "Позвонить", "Написать", "Встретиться", "Пригласить", "Попросить помощи",
    "Пройти курс", "Прочитать книгу", "Найти наставника", "Попробовать", "Отработать",
  ],
};

// ==== Мистер Пропер: пул предложений для метки «Гид» ====

const PROPER_OFFERS = [
  { id: "bathroom", text: "Ты в неё смотришь, а она смотрит на тебя. Помой уже.", taskTitle: "Помыть ванну" },
  { id: "closet", text: "У тебя в шкафу вещи из прошлой жизни. Разбери.", taskTitle: "Разобрать шкаф" },
  { id: "windows", text: "Через твои окна ничего не видно. Помой.", taskTitle: "Помыть окна" },
  { id: "museum", text: "В твоём городе есть музей. Ты там был?", taskTitle: "Сходить в музей" },
  { id: "monument", text: "Ты ходишь мимо этого памятника уже который год. Остановись хоть раз.", taskTitle: "Посмотреть на памятник в центре" },
  { id: "library", text: "В библиотеке книги бесплатно. Да, до сих пор.", taskTitle: "Взять книгу в библиотеке" },
  { id: "nearby-town", text: "Ты в соседнем городе не был. А он в часе езды.", taskTitle: "Съездить в соседний город на день" },
  { id: "purchase", text: "У тебя в корзине что-то висит месяца три. Купи, не умрёшь.", taskTitle: "Купить то, что давно хотел" },
  { id: "parents", text: "Ты давно звонил родителям?", taskTitle: "Позвонить родителям" },
  { id: "old-friend", text: "Помнишь его? Напиши. Он не кусается.", taskTitle: "Написать старому другу" },
  { id: "trial-class", text: "Пробное занятие — это час. Хуже не будет.", taskTitle: "Записаться на пробное занятие" },
  {
    id: "language",
    text: "Ты говорил, что хочешь выучить язык. Два года назад.",
    taskTitle: "Выучить иностранный язык",
    starterNotes: ["Выбрать язык", "Скачать приложение", "Заниматься 15 минут в день"],
  },
  {
    id: "big-trip",
    text: "Назови место, куда поедешь. Сингапур? Арктика? Не мне, себе назови.",
    taskTitle: "Съездить в место, о котором давно думаешь",
    starterNotes: ["Выбрать место", "Посчитать бюджет", "Отложить первую сумму"],
  },
  {
    id: "book",
    text: "Ты говорил, что напишешь книгу. Лет пять назад. Я помню.",
    taskTitle: "Написать книгу / мемуары / сценарий",
    starterNotes: ["Определить тему", "Написать одну страницу — сегодня"],
  },
];

// ==== Мистер Жопер: пул заданий (дисциплина, спорт, рутина) ====
const JOPER_OFFERS = [
  { id: "j_pushups", text: "ОТЖИМАНИЯ. 3 ПОДХОДА. СЕГОДНЯ.", taskTitle: "Сделать 3 подхода отжиманий" },
  { id: "j_run", text: "ПРОБЕЖКА. 3 КМ. НЕ НОЙ.", taskTitle: "Пробежать 3 км" },
  { id: "j_wake", text: "ВСТАТЬ В 7. БЕЗ ОТГОВОРОК.", taskTitle: "Встать в 7 утра" },
  { id: "j_plank", text: "ПЛАНКА. 2 МИНУТЫ. ДЕРЖАТЬ.", taskTitle: "Планка 2 минуты" },
  { id: "j_sugar", text: "НЕДЕЛЯ БЕЗ САХАРА. СЛАБО?", taskTitle: "Неделя без сахара" },
  { id: "j_sleep", text: "СПАТЬ 8 ЧАСОВ. НЕ 6. ВОСЕМЬ.", taskTitle: "Спать 8 часов" },
  { id: "j_steps", text: "10 000 ШАГОВ. НЕ МЕНЬШЕ.", taskTitle: "Пройти 10 000 шагов" },
  { id: "j_cold", text: "ХОЛОДНЫЙ ДУШ. 30 СЕКУНД.", taskTitle: "Холодный душ 30 секунд" },
];

// ==== Титулы за задания от Гида ====
// Ключ — сколько заданий от гида выполнено; открывается по достижении.
const GUIDE_TITLES = {
  proper: {
    1: { name: "Уборщик", emoji: "🧹", desc: "Первый шаг сделан." },
    3: { name: "Чистюля", emoji: "🧼", desc: "Ты втянулся." },
    5: { name: "Хозяин", emoji: "🏠", desc: "Дом под контролем." },
    7: { name: "Домовой", emoji: "🧙", desc: "Дом чувствует тебя." },
    10: { name: "Мастер чистоты", emoji: "👑", desc: "Идеал. Достигнут." },
  },
  joper: {
    1: { name: "Новобранец", emoji: "🪖", desc: "Принят в строй." },
    3: { name: "Боец", emoji: "💪", desc: "Дисциплина есть." },
    5: { name: "Сержант", emoji: "🎖", desc: "Сам можешь командовать." },
    7: { name: "Лейтенант", emoji: "⚔️", desc: "Тело — инструмент." },
    10: { name: "Капитан", emoji: "🏅", desc: "Не сломался. Уважаю." },
  },
};
const GUIDE_TITLE_TIERS = [1, 3, 5, 7, 10];

// Метаданные гидов — для GuideOverlay и TitlesOverlay
const GUIDE_META = {
  proper: { name: "МИСТЕР ПРОПЕР", emoji: "🧹", color: "#BDEFC9" },
  joper: { name: "МИСТЕР ЖОПЕР", emoji: "🎖", color: "#FFD5B0" },
};

// После 10 принятых заданий открывается рандомайзер — большой плоский
// пул рутинных дел, из которого можно крутить случайное задание.
const GUIDE_CHAINS = {
  proper: PROPER_OFFERS,
  joper: JOPER_OFFERS,
};

const PROPER_RANDOM_POOL = [
  "Помыть посуду", "Вынести мусор", "Пропылесосить", "Помыть полы", "Протереть пыль",
  "Полить цветы", "Помыть окна", "Разобрать шкаф", "Постирать бельё", "Погладить одежду",
  "Заправить кровать", "Почистить плиту", "Помыть холодильник", "Разморозить морозилку",
  "Организовать ящик для столовых приборов", "Помыть люстру", "Почистить ковёр", "Помыть зеркала",
  "Разобрать балкон", "Починить кран", "Заменить лампочку", "Поклеить обои", "Покрасить стену",
  "Собрать мебель", "Повесить полку", "Убрать провода", "Помыть вентиляцию",
  "Почистить стиральную машину", "Заменить фильтр для воды", "Помыть микроволновку",
  "Почистить чайник от накипи", "Помыть вытяжку", "Разобрать аптечку", "Проверить сроки лекарств",
  "Организовать документы", "Разобрать почту", "Оплатить коммунальные", "Проверить счётчики",
  "Помыть входную дверь", "Почистить обувь", "Разобрать обувницу", "Помыть зонт",
  "Постирать шторы", "Помыть карниз", "Почистить кондиционер", "Помыть радиаторы",
  "Убрать паутину", "Помыть подоконники", "Разобрать кладовку", "Подписать банки с крупами",
  "Разобрать специи", "Помыть банки", "Организовать пакеты", "Сложить пакеты треугольником",
  "Починить стул", "Смазать петли", "Помыть дверные ручки", "Продезинфицировать выключатели",
  "Помыть пульты", "Почистить клавиатуру", "Помыть мышь", "Протереть монитор",
  "Убрать пыль с техники", "Организовать зарядки", "Подписать провода",
  "Разобрать ящик с мелочами", "Выбросить сломанные вещи", "Отдать вещи на благотворительность",
  "Продать ненужное", "Сфотографировать вещи для продажи", "Помыть клетку питомца",
  "Почистить аквариум", "Помыть миски питомца", "Купить корм", "Записаться к ветеринару",
  "Помыть игрушки питомца", "Постирать лежанку", "Расчесать питомца", "Подстричь когти",
  "Помыть лапы после прогулки", "Проверить дымовую сигнализацию", "Проверить огнетушитель",
  "Собрать тревожный чемодан", "Проверить аптечку первой помощи", "Составить план эвакуации",
  "Проверить проводку", "Убрать легковоспламеняющееся", "Проверить замки", "Смазать замки",
  "Починить доводчик", "Помыть домофон", "Проверить видеонаблюдение", "Обновить пароли",
  "Сделать резервную копию", "Почистить телефон", "Удалить лишние фото", "Разобрать галерею",
  "Организовать облако", "Отписаться от рассылок", "Удалить неиспользуемые приложения",
];

// У Жопера пока нет отдельного большого списка — используем его обычные
// Когда появится свой список на 100 пунктов, просто

const JOPER_RANDOM_POOL = JOPER_OFFERS.map((o) => o.taskTitle);

const GUIDE_RANDOM_POOLS = {
  proper: PROPER_RANDOM_POOL,
  joper: JOPER_RANDOM_POOL,
};

const GUIDE_UNLOCK_RANDOM_AT = 10;

// ==== Публичный пул задач («Другие») ====
// адрес своего сервера
// Ожидаемый протокол, когда сервер появится:
//   POST {SHARE_API.baseUrl}/share   body: { title, due }   — анонимно добавить в пул
//   GET  {SHARE_API.baseUrl}/pool                            — получить пул: [{ title, due, count }]
// Пока baseUrl пустой — используется локальный демо-пул (AsyncStorage),
// чтобы экран «Другие» уже можно было пощупать без сервера.
const SHARE_API = {
  baseUrl: "", // ← впиши сюда адрес сервера, когда он будет готов
};
const SHARE_POOL_KEY = "questmap_shared_pool_v1";

const initialScreens = {
  main: {
    id: "main",
    name: "КАРТА",
    theme: "terrain",
    parentId: null,
    image: MAP_DEFAULT_BG,
    markers: [{ id: "dom", special: true, name: "Дом", emoji: "🏠", color: "#E4572E", x: 50, y: 75, linkTo: "home" }],
  },
  home: {
    id: "home",
    name: "🏠 ДОМ — ДЕЛА",
    theme: "home",
    parentId: "main",
    image: DOM_DEFAULT_BG,
    markers: [
      {
        id: "shopping",
        name: "Покупки",
        emoji: "🛒",
        color: "#2A9D8F",
        type: "home",
        x: 22,
        y: 22,
        tasks: [
          { id: nextId(), title: "Подготовить покупки на новоселье", due: null, done: false, notes: [], createdAt: NOW },
          { id: nextId(), title: "Купить газонокосилку", due: null, done: false, notes: [], createdAt: NOW },
        ],
      },
      {
        id: "library",
        name: "Библиотека / учёба",
        emoji: "📚",
        color: "#3D5A80",
        type: "study",
        x: 72,
        y: 24,
        tasks: [{ id: nextId(), title: "Взять книгу «Ассемблер» (1975) — библиотека", due: null, done: false, notes: [], createdAt: NOW }],
      },
      {
        id: "chores",
        name: "Хозяйство",
        emoji: "🔧",
        color: "#E76F51",
        type: "home",
        x: 28,
        y: 66,
        tasks: [
          { id: nextId(), title: "Полить цветы", due: { date: todayStr(0), time: "19:00", kind: "date" }, done: false, notes: [], createdAt: NOW },
          { id: nextId(), title: "Починить шкаф", due: { date: todayStr(5), time: null, kind: "date" }, done: false, notes: [], createdAt: NOW },
        ],
      },
      { id: "misc", name: "Разное", emoji: "✨", color: "#B08968", type: "general", x: 76, y: 64, tasks: [] },
    ],
  },
};

/* -------- small shared UI bits -------- */

function Chip({ label, active, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 14,
          paddingVertical: 4,
          paddingHorizontal: 10,
          backgroundColor: active ? INK : CARD,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 11.5, color: active ? "#fff" : INK, fontWeight: "bold" }}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress, color = INK, textColor = "#fff", style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: color,
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 8,
          paddingVertical: 9,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontWeight: "bold", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

function Overlay({ children, zIndex = 50, background = PAPER }) {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: background, zIndex, elevation: zIndex }}>
      {children}
    </View>
  );
}

function OverlayHeader({ onBack, backLabel = "Назад", title, onClose }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1.5,
        borderColor: INK,
      }}
    >
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 60 }}>
        <Text style={{ fontSize: 16 }}>←</Text>
        <Text style={{ fontWeight: "bold", color: INK }}>{backLabel}</Text>
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: "bold", color: INK, textAlign: "center", flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <Pressable onPress={onClose || onBack} style={{ minWidth: 60, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 18 }}>✕</Text>
      </Pressable>
    </View>
  );
}

/* -------- Pin (draggable marker on the map) -------- */

function Pin({ marker, editMode, editAction, containerSize, onOpen, onDragMove, onDelete }) {
  const size = marker.special ? 58 : 46;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderMove: (evt, gesture) => {
      if (!containerSize.width || !containerSize.height) return;
      const dxPct = (gesture.dx / containerSize.width) * 100;
      const dyPct = (gesture.dy / containerSize.height) * 100;
      let nx = marker.x + dxPct;
      let ny = marker.y + dyPct;
      nx = Math.min(95, Math.max(5, nx));
      ny = Math.min(93, Math.max(7, ny));
      onDragMove(marker.id, nx, ny);
    },
  });

  const doneCount = marker.tasks ? marker.tasks.filter((t) => t.done).length : 0;
  const total = marker.tasks ? marker.tasks.length : 0;
  const previewTasks = marker.tasks ? marker.tasks.filter((t) => !t.done).slice(0, 2) : [];

  const handlePress = () => {
    if (editMode) {
      if (editAction === "delete") onDelete(marker);
      return;
    }
    onOpen(marker);
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        alignItems: "center",
        zIndex: 2,
      }}
    >
      <Pressable onPress={handlePress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: marker.color,
            borderWidth: 2.5,
            borderColor: INK,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            shadowColor: INK,
            shadowOffset: { width: 2, height: 3 },
            shadowOpacity: 0.35,
            shadowRadius: 0,
            elevation: 4,
          }}
        >
          {marker.image ? (
            <Image source={{ uri: marker.image }} style={{ width: size, height: size }} />
          ) : (
            <Text style={{ fontSize: marker.special ? 24 : 19 }}>{marker.emoji}</Text>
          )}
          {marker.image && (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: INK,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10 }}>{marker.emoji}</Text>
            </View>
          )}
          {editMode && (
            <View
              style={{
                position: "absolute",
                bottom: -5,
                right: -5,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: editAction === "delete" ? "#E4572E" : "#fff",
                borderWidth: 2,
                borderColor: INK,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9 }}>{editAction === "delete" ? "🗑" : "✥"}</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View
        style={{
          marginTop: 4,
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: INK,
          borderRadius: 8,
          paddingHorizontal: 7,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "bold", color: INK }}>
          {marker.name}
          {total > 0 ? <Text style={{ fontWeight: "normal", opacity: 0.6 }}> {doneCount}/{total}</Text> : null}
        </Text>
      </View>

      {!editMode && previewTasks.length > 0 && (
        <View style={{ marginTop: 3, alignItems: "center" }}>
          {previewTasks.map((t) => (
            <View
              key={t.id}
              style={{
                marginTop: 2,
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: INK,
                paddingHorizontal: 6,
                paddingVertical: 2,
                maxWidth: 110,
              }}
            >
              <Text style={{ fontSize: 9.5, fontFamily: "monospace", color: isTaskExpired(t) ? BLUE : "#5b4c3f" }} numberOfLines={1}>
                {shortLabel(t.title)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* -------- Hints modal (places / task suggestions) -------- */

function HintsModal({ title, groups, items, onClose, onPick }) {
  return (
    <Overlay zIndex={70} background="rgba(59,47,47,0.55)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: PAPER,
            borderWidth: 3,
            borderColor: INK,
            borderRadius: 18,
            width: "100%",
            maxWidth: 340,
            maxHeight: "82%",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1.5, borderColor: INK }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: INK, flex: 1, paddingRight: 8 }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ padding: 14 }}>
            {groups &&
              groups.map((g) => (
                <View key={g.layer} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 6 }}>{g.layer}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {g.items.map((it) => {
                      const label = typeof it === "string" ? it : `${it.emoji} ${it.name}`;
                      return <Chip key={label} label={label} onPress={() => onPick({ ...(typeof it === "string" ? { name: it } : it), type: g.type })} />;
                    })}
                  </View>
                </View>
              ))}

            {items && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {items.map((it) => (
                  <Chip key={it} label={it} onPress={() => onPick(it)} />
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

/* -------- Confirm dialog -------- */

function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "Удалить", confirmColor = "#E4572E" }) {
  return (
    <Overlay zIndex={65} background="rgba(59,47,47,0.5)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onCancel}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: PAPER, borderWidth: 3, borderColor: INK, borderRadius: 16, width: "100%", maxWidth: 260, padding: 18 }}
        >
          <Text style={{ fontSize: 14, color: INK, marginBottom: 14, textAlign: "center" }}>{message}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <PrimaryButton label="Отмена" color="#fff" textColor={INK} onPress={onCancel} style={{ flex: 1 }} />
            <PrimaryButton label={confirmLabel} color={confirmColor} onPress={onConfirm} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

function InfoDialog({ message, onClose }) {
  return (
    <Overlay zIndex={65} background="rgba(59,47,47,0.5)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: PAPER, borderWidth: 3, borderColor: INK, borderRadius: 16, width: "100%", maxWidth: 260, padding: 18 }}
        >
          <Text style={{ fontSize: 14, color: INK, marginBottom: 14, textAlign: "center" }}>{message}</Text>
          <PrimaryButton label="Ок" color={GREEN} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

/* -------- Due editor: без срока / дата (текстом) / срок (дни) -------- */

function MiniCalendar({ value, onChange }) {
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // понедельник = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const todayIso = todayStr(0);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDay = (d) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
  };

  return (
    <View style={{ borderWidth: 2, borderColor: INK, borderRadius: 8, padding: 8, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Pressable onPress={() => setViewDate(new Date(year, month - 1, 1))} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 15, color: INK, fontWeight: "bold" }}>‹</Text>
        </Pressable>
        <Text style={{ fontSize: 12.5, fontWeight: "bold", color: INK, textTransform: "capitalize" }}>{monthName}</Text>
        <Pressable onPress={() => setViewDate(new Date(year, month + 1, 1))} style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 15, color: INK, fontWeight: "bold" }}>›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <Text key={d} style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 9.5, color: "#8a7a6a" }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((d, i) => {
          const dateStr = d ? `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
          const isSelected = dateStr && dateStr === value;
          const isToday = dateStr === todayIso;
          return (
            <Pressable key={i} disabled={!d} onPress={() => d && selectDay(d)} style={{ width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" }}>
              {d && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isSelected ? INK : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: INK,
                  }}
                >
                  <Text style={{ fontSize: 11, color: isSelected ? "#fff" : INK, fontWeight: isToday ? "bold" : "normal" }}>{d}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DueEditor({ dueMode, setDueMode, dueDate, setDueDate, dueTime, setDueTime, dueDays, setDueDays }) {
  const [showCalendar, setShowCalendar] = useState(false);

  const handleTimeChange = (raw) => {
    const digitsOnly = raw.replace(/[^0-9]/g, "");
    const prevDigitsOnly = dueTime.replace(/[^0-9]/g, "");
    const next = digitsOnly.slice(0, 4);
    let formatted;
    if (next.length <= 2) {
      formatted = next;
      if (next.length === 2 && digitsOnly.length > prevDigitsOnly.length) formatted = `${next}:`;
    } else {
      formatted = `${next.slice(0, 2)}:${next.slice(2)}`;
    }
    setDueTime(formatted);
  };

  const displayDate = dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Выбрать дату";

  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
        {[
          { key: "none", label: "Без срока" },
          { key: "date", label: "📅 Дата" },
          { key: "duration", label: "⏳ Срок" },
        ].map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setDueMode(opt.key)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: INK,
              backgroundColor: dueMode === opt.key ? INK : "#fff",
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "bold", color: dueMode === opt.key ? "#fff" : INK }}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {dueMode === "date" && (
        <View>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: showCalendar ? 8 : 4 }}>
            <Pressable
              onPress={() => setShowCalendar((v) => !v)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 13 }}>📅</Text>
              <Text style={{ fontSize: 12.5, color: dueDate ? INK : "#a0907e", fontWeight: dueDate ? "bold" : "normal" }} numberOfLines={1}>
                {displayDate}
              </Text>
            </Pressable>
            <TextInput
              value={dueTime}
              onChangeText={handleTimeChange}
              placeholder="ЧЧ:ММ"
              placeholderTextColor="#a0907e"
              keyboardType="numeric"
              style={{ width: 80, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12.5 }}
            />
          </View>

          {showCalendar && (
            <MiniCalendar
              value={dueDate}
              onChange={(d) => {
                setDueDate(d);
                setShowCalendar(false);
              }}
            />
          )}
        </View>
      )}

      {dueMode === "duration" && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Pressable onPress={() => setDueDays((d) => Math.max(1, d - 1))} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "bold" }}>−</Text>
          </Pressable>
          <Text style={{ minWidth: 26, textAlign: "center", fontWeight: "bold", color: INK }}>{dueDays}</Text>
          <Pressable onPress={() => setDueDays((d) => d + 1)} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "bold" }}>+</Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: "#8a7a6a" }}>дней с отсчётом</Text>
        </View>
      )}
    </View>
  );
}

/* -------- Notes overlay for a single task -------- */

function TaskDetailOverlay({ task, markerColor, onBack, onAddNote, onRemoveNote, onToggleNote }) {
  const [note, setNote] = useState("");
  const expired = isTaskExpired(task);
  const submit = () => {
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote("");
  };
  return (
    <Overlay zIndex={52}>
      <OverlayHeader onBack={onBack} title="" onClose={onBack} />
      <ScrollView style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "bold", color: expired ? BLUE : INK, marginBottom: 14 }}>{task.title}</Text>

        <View style={{ marginBottom: 16, gap: 6 }}>
          {(!task.notes || task.notes.length === 0) && <Text style={{ color: "#a0907e", fontSize: 12.5, fontStyle: "italic" }}>Пометок пока нет.</Text>}
          {task.notes &&
            task.notes.map((n, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: CARD, borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Pressable style={{ flex: 1 }} onPress={() => onToggleNote(i)}>
                  <Text style={{ fontSize: 13, color: n.done ? "#9a8a76" : INK, textDecorationLine: n.done ? "line-through" : "none" }}>{n.text}</Text>
                </Pressable>
                <Pressable onPress={() => onRemoveNote(i)}>
                  <Text style={{ opacity: 0.5 }}>✕</Text>
                </Pressable>
              </View>
            ))}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Новая пометка..."
            placeholderTextColor="#a0907e"
            style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }}
          />
          <Pressable onPress={submit} style={{ backgroundColor: markerColor, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>＋</Text>
          </Pressable>
        </View>

        <View style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 12, padding: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: expired ? BLUE : INK }}>{formatRemaining(task.due)}</Text>
        </View>
      </ScrollView>
    </Overlay>
  );
}

/* -------- Task list ("Дела") for one marker -------- */

function TaskScreen({ marker, onClose, onToggle, onAdd, onDelete, onAddNote, onRemoveNote, onToggleNote, onShare, onIncrementRepeat }) {
  const [title, setTitle] = useState("");
  const [dueMode, setDueMode] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [dueDays, setDueDays] = useState(1);
  const [noteTaskId, setNoteTaskId] = useState(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);
  const [shareToPool, setShareToPool] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatTarget, setRepeatTarget] = useState(5);
  if (!marker) return null;

  const noteTask = marker.tasks && marker.tasks.find((t) => t.id === noteTaskId);
  const pendingTask = marker.tasks && marker.tasks.find((t) => t.id === pendingDeleteTaskId);

  const submit = () => {
    if (!title.trim()) return;
    let due = null;
    if (dueMode === "date") {
      if (dueDate || dueTime) due = { date: dueDate || null, time: dueTime || null, kind: "date" };
    } else if (dueMode === "duration") {
      due = { target: Date.now() + dueDays * 86400000, kind: "duration" };
    }
    const repeat = repeatOn ? { count: 0, target: Math.max(1, repeatTarget) } : null;
    onAdd(marker.id, title.trim(), due, repeat);
    if (shareToPool && onShare) onShare(title.trim(), due);
    setTitle("");
    setDueMode("none");
    setDueDate("");
    setDueTime("");
    setDueDays(1);
    setShareToPool(false);
    setRepeatOn(false);
    setRepeatTarget(5);
  };

  return (
    <Overlay zIndex={50}>
      <OverlayHeader onBack={onClose} title={`${marker.emoji} ${marker.name.toUpperCase()}`} onClose={onClose} />
      {marker.image && (
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <Image source={{ uri: marker.image }} style={{ width: 90, height: 90, borderRadius: 12, borderWidth: 2, borderColor: INK }} />
        </View>
      )}
      <Text style={{ paddingHorizontal: 16, paddingTop: 10, fontSize: 12, letterSpacing: 1, color: "#8a7a6a" }}>ДЕЛА</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {(!marker.tasks || marker.tasks.length === 0) && (
          <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Пока пусто — самое время добавить первое дело.</Text>
        )}
        {marker.tasks &&
          marker.tasks.map((t) => {
            const expired = isTaskExpired(t);
            return (
              <View
                key={t.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  backgroundColor: t.done ? "#F1EEE4" : CARD,
                  borderWidth: 2,
                  borderColor: INK,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                {t.repeat && !t.done ? (
                  <Pressable
                    onPress={() => onIncrementRepeat(marker.id, t.id)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      borderWidth: 2,
                      borderColor: INK,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                      backgroundColor: "#fff",
                    }}
                  >
                    <View style={{ width: 14, height: 2.5, borderRadius: 1.5, backgroundColor: INK, position: "absolute" }} />
                    <View style={{ width: 2.5, height: 14, borderRadius: 1.5, backgroundColor: INK, position: "absolute" }} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => onToggle(marker.id, t.id)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      borderWidth: 2,
                      borderColor: INK,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                      backgroundColor: t.done ? BLUE : "transparent",
                    }}
                  >
                    {t.done && <Text style={{ color: "#fff", fontSize: 15 }}>✓</Text>}
                  </Pressable>
                )}

                <Pressable style={{ flex: 1 }} onPress={() => setNoteTaskId(t.id)}>
                  <Text
                    style={{
                      fontSize: 14,
                      color: expired ? BLUE : INK,
                      textDecorationLine: t.done ? "line-through" : "none",
                      opacity: t.done ? 0.55 : 1,
                      fontWeight: expired ? "bold" : "normal",
                    }}
                  >
                    {t.title}
                  </Text>
                  {t.repeat && (
                    <View style={{ marginTop: 4, marginBottom: 2 }}>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: "#E5DCC8", overflow: "hidden" }}>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: GREEN, width: `${Math.min(100, (t.repeat.count / t.repeat.target) * 100)}%` }} />
                      </View>
                      <Text style={{ fontSize: 10.5, color: "#9a8a76", marginTop: 2 }}>
                        {t.repeat.count}/{t.repeat.target}
                      </Text>
                    </View>
                  )}
                  {t.notes && t.notes.length > 0 && (
                    <View style={{ marginTop: 3, gap: 1 }}>
                      {t.notes.map((n, i) => (
                        <Text key={i} style={{ fontSize: 11.5, color: n.done ? "#b0a496" : "#6b5b4d", textDecorationLine: n.done ? "line-through" : "none" }}>
                          [{n.text}]
                        </Text>
                      ))}
                    </View>
                  )}
                  <Text style={{ fontSize: 11, marginTop: 3, color: expired ? BLUE : "#9a8a76", fontWeight: expired || t.due ? "bold" : "normal" }}>
                    {formatRemaining(t.due)}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setPendingDeleteTaskId(t.id)} style={{ marginTop: 2 }}>
                  <Text style={{ opacity: 0.5 }}>✕</Text>
                </Pressable>
              </View>
            );
          })}
      </ScrollView>

      <View style={{ borderTopWidth: 1.5, borderColor: INK, padding: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Новое дело..."
          placeholderTextColor="#a0907e"
          style={{ borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, marginBottom: 8 }}
        />

        <DueEditor dueMode={dueMode} setDueMode={setDueMode} dueDate={dueDate} setDueDate={setDueDate} dueTime={dueTime} setDueTime={setDueTime} dueDays={dueDays} setDueDays={setDueDays} />

        <Pressable onPress={() => setRepeatOn((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: repeatOn ? 6 : 10 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: INK,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: repeatOn ? INK : "#fff",
            }}
          >
            {repeatOn && <Text style={{ color: "#fff", fontSize: 11 }}>✓</Text>}
          </View>
          <Text style={{ fontSize: 11.5, color: INK }}>🔁 Повторяющееся задание</Text>
        </Pressable>

        {repeatOn && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 }}>
            <Pressable onPress={() => setRepeatTarget((n) => Math.max(1, n - 1))} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontWeight: "bold" }}>−</Text>
            </Pressable>
            <Text style={{ minWidth: 26, textAlign: "center", fontWeight: "bold", color: INK }}>{repeatTarget}</Text>
            <Pressable onPress={() => setRepeatTarget((n) => n + 1)} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontWeight: "bold" }}>+</Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: "#8a7a6a" }}>раз — дело завершится, когда наберётся столько</Text>
          </View>
        )}

        <Pressable onPress={() => setShareToPool((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: INK,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: shareToPool ? INK : "#fff",
            }}
          >
            {shareToPool && <Text style={{ color: "#fff", fontSize: 11 }}>✓</Text>}
          </View>
          <Text style={{ fontSize: 11.5, color: INK }}>🌐 Поделиться задачей (анонимно, в «Другие»)</Text>
        </Pressable>

        <PrimaryButton label="Добавить дело" color="#BDEFC9" textColor={INK} onPress={submit} />
      </View>

      {noteTask && (
        <TaskDetailOverlay
          task={noteTask}
          markerColor={marker.color}
          onBack={() => setNoteTaskId(null)}
          onAddNote={(text) => onAddNote(marker.id, noteTaskId, text)}
          onRemoveNote={(idx) => onRemoveNote(marker.id, noteTaskId, idx)}
          onToggleNote={(idx) => onToggleNote(marker.id, noteTaskId, idx)}
        />
      )}

      {pendingTask && (
        <ConfirmDialog
          message={`Удалить дело «${pendingTask.title}»?`}
          onCancel={() => setPendingDeleteTaskId(null)}
          onConfirm={() => {
            onDelete(marker.id, pendingDeleteTaskId);
            setPendingDeleteTaskId(null);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- New marker / new field form -------- */

function NewPinForm({ title, onClose, onCreate, confirmLabel, showColor = true, showPlaceHints = true, imageAspect = [1, 1] }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📍");
  const [color, setColor] = useState(PALETTE[0]);
  const [type, setType] = useState("general");
  const [image, setImage] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [asField, setAsField] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: imageAspect,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const src = result.assets[0].uri;
      const ext = src.split(".").pop() || "jpg";
      const dst = `${FileSystem.documentDirectory}pin_${Date.now()}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: src, to: dst });
        setImage(dst);
      } catch (e) {
        setImage(src); // если копирование не удалось — оставим временный
      }
    }
  };

  return (
    <Overlay zIndex={60} background="rgba(59,47,47,0.45)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: PAPER, borderWidth: 3, borderColor: INK, borderRadius: 18, width: "100%", maxWidth: 280, padding: 18 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "bold", color: INK }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          {showColor && showPlaceHints && (
            <Text style={{ fontSize: 11.5, color: "#8a7a6a", fontStyle: "italic", marginBottom: 8, lineHeight: 16 }}>
              Введите места, которые представляют для вас интерес — например: универмаг, огород соседа, библиотека, дома родственников и знакомых, или места, в которых вы ещё даже не были, но в них могут быть какие-то ваши цели
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Pressable
              onPress={pickImage}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                borderWidth: 1.5,
                borderColor: INK,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {image ? <Image source={{ uri: image }} style={{ width: 52, height: 52 }} /> : <Text style={{ fontSize: 18 }}>📷</Text>}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: INK, fontWeight: "bold" }}>{image ? "Фото выбрано" : "Своё фото (необязательно)"}</Text>
              <Text style={{ fontSize: 10.5, color: "#8a7a6a" }}>Из галереи телефона</Text>
            </View>
            {image && (
              <Pressable onPress={() => setImage(null)}>
                <Text style={{ opacity: 0.5 }}>✕</Text>
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <TextInput
              value={emoji}
              onChangeText={(v) => setEmoji(Array.from(v).slice(0, 4).join(""))}
              style={{ width: 44, textAlign: "center", fontSize: 18, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingVertical: 6 }}
            />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Название"
              placeholderTextColor="#a0907e"
              style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13.5 }}
            />
          </View>

          {showColor && showPlaceHints && (
            <Pressable
              onPress={() => setShowHints(true)}
              style={{ alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingVertical: 6, marginBottom: 12, backgroundColor: CARD }}
            >
              <Text style={{ fontSize: 12, color: INK }}>💡 Подсказки — какие места бывают?</Text>
            </Pressable>
          )}

          {!showColor && (
            <Text style={{ textAlign: "center", fontSize: 11.5, color: "#8a7a6a", fontStyle: "italic", marginBottom: 12, lineHeight: 16 }}>
              💡 Поле — это большая локация (например, другой город, или страна). Создавайте его, если в локации требуется много меток или категорий
            </Text>
          )}

          {showColor && (
            <>
              <Text style={{ fontSize: 11.5, color: "#8a7a6a", marginBottom: 6 }}>Цвет метки</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 2,
                      borderColor: color === c ? INK : "transparent",
                    }}
                  />
                ))}
              </View>

              <Pressable onPress={() => setAsField((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: INK,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: asField ? INK : "#fff",
                  }}
                >
                  {asField && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, color: INK, fontWeight: "bold" }}>🗺 Сделать полем (как «Дом»)</Text>
                  <Text style={{ fontSize: 10.5, color: "#8a7a6a" }}>Своя карта с метками вместо списка дел</Text>
                </View>
              </Pressable>
            </>
          )}

          <PrimaryButton
            label={confirmLabel}
            color={color}
            onPress={() => name.trim() && onCreate({ name: name.trim(), emoji: emoji.trim(), color, type, image, asField })}
          />
        </Pressable>
      </Pressable>

      {showHints && showPlaceHints && (
        <HintsModal
          title="💡 Места, куда можно попасть"
          groups={PLACE_HINTS}
          onClose={() => setShowHints(false)}
          onPick={(it) => {
            setName(it.name);
            setEmoji(it.emoji);
            setType(it.type || "general");
            setShowHints(false);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- Журнал: список активных дел + карточка одного дела -------- */

function JournalList({ entries, onClose, onOpenDetail }) {
  return (
    <Overlay zIndex={55}>
      <OverlayHeader onBack={onClose} title="📖 ЖУРНАЛ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {entries.length === 0 && <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Активных дел пока нет.</Text>}
        {entries.map((e) => (
          <Pressable
            key={e.task.id}
            onPress={() => onOpenDetail(e)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 10, padding: 10 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: e.markerColor, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14 }}>{e.markerEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, color: INK, fontWeight: "bold" }}>{e.task.title}</Text>
              <Text style={{ fontSize: 10.5, color: "#9a8a76" }}>
                {e.screenName.replace(/^[^\wА-Яа-я]+/, "")} · {e.markerName}
              </Text>
              {e.task.repeat && (
                <View style={{ marginTop: 5 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: "#E5DCC8", overflow: "hidden" }}>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: GREEN, width: `${Math.min(100, (e.task.repeat.count / e.task.repeat.target) * 100)}%` }} />
                  </View>
                  <Text style={{ fontSize: 10, color: "#9a8a76", marginTop: 2 }}>
                    {e.task.repeat.count}/{e.task.repeat.target}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10.5, color: "#6b5b4d", fontFamily: "monospace" }}>{formatRemaining(e.task.due)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Overlay>
  );
}

function JournalDetail({ entry, onBack, onClose, onAddNote, onRemoveNote, onToggleNote }) {
  const [note, setNote] = useState("");
  if (!entry) return null;
  const submit = () => {
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote("");
  };
  return (
    <Overlay zIndex={58}>
      <OverlayHeader onBack={onBack} backLabel="Журнал" title="" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 19, fontWeight: "bold", color: INK, marginBottom: 4 }}>
          {entry.markerEmoji} {entry.task.title}
        </Text>
        <Text style={{ fontSize: 11.5, color: "#9a8a76", marginBottom: 14 }}>
          {entry.markerName} · {entry.screenName.replace(/^[^\wА-Яа-я]+/, "")}
        </Text>

        <View style={{ gap: 6, marginBottom: 16 }}>
          {entry.task.notes.length === 0 && <Text style={{ color: "#a0907e", fontSize: 12.5, fontStyle: "italic" }}>Пометок пока нет.</Text>}
          {entry.task.notes.map((n, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: CARD, borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Pressable style={{ flex: 1 }} onPress={() => onToggleNote(i)}>
                <Text style={{ fontSize: 13, color: n.done ? "#9a8a76" : INK, textDecorationLine: n.done ? "line-through" : "none" }}>{n.text}</Text>
              </Pressable>
              <Pressable onPress={() => onRemoveNote(i)}>
                <Text style={{ opacity: 0.5 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Новая пометка..."
            placeholderTextColor="#a0907e"
            style={{ flex: 1, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 }}
          />
          <Pressable onPress={submit} style={{ backgroundColor: entry.markerColor, borderWidth: 2, borderColor: INK, borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>＋</Text>
          </Pressable>
        </View>

        <View style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 12, padding: 14, alignItems: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: isTaskExpired(entry.task) ? BLUE : INK }}>{formatRemaining(entry.task.due)}</Text>
        </View>
      </ScrollView>
    </Overlay>
  );
}

/* -------- История -------- */

function HistoryList({ entries, onClose, onDeleteEntry }) {
  const [pending, setPending] = useState(null);
  return (
    <Overlay zIndex={55}>
      <OverlayHeader onBack={onClose} title="🕓 ИСТОРИЯ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {entries.length === 0 && <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Пока нет ни одного дела.</Text>}
        {entries.map((e) => {
          const status = e.removedAt ? (e.task.done ? "Выполнено" : "Удалено") : e.task.done ? "Выполнено" : isTaskExpired(e.task) ? "Провалено" : "Активно";
          const statusColor = e.task.done ? "#2A9D8F" : e.removedAt ? "#C0392B" : isTaskExpired(e.task) ? BLUE : "#8a7a6a";
          const canDelete = status === "Выполнено" || status === "Удалено";
          return (
            <View key={`${e.task.id}-${e.removedAt || "live"}`} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 2, borderColor: INK, borderRadius: 10, padding: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: e.markerColor, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13 }}>{e.markerEmoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: INK, fontWeight: "bold" }}>{e.task.title}</Text>
                <Text style={{ fontSize: 10, color: "#9a8a76" }}>
                  {e.markerName} · создано {fmtDate(e.task.createdAt)}
                  {e.task.repeat ? ` · ${e.task.repeat.count}/${e.task.repeat.target}` : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: "bold", color: statusColor }}>{status}</Text>
              {canDelete && (
                <Pressable onPress={() => setPending(e)}>
                  <Text style={{ opacity: 0.5, fontSize: 13 }}>🗑</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      {pending && (
        <ConfirmDialog
          message={`Удалить «${pending.task.title}» из истории?`}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            onDeleteEntry(pending);
            setPending(null);
          }}
        />
      )}
    </Overlay>
  );
}

/* -------- Main app -------- */

function MarkerPickerModal({ screens, onPick, onClose }) {
  const rows = [];
  Object.values(screens).forEach((scr) => {
    (scr.markers || []).forEach((mk) => {
      if (mk.isGuide || mk.linkTo) return; // порталы и гид не хранят дел
      rows.push({ screenId: scr.id, screenName: scr.name, markerId: mk.id, markerName: mk.name, emoji: mk.emoji, color: mk.color });
    });
  });
  return (
    <Overlay zIndex={72} background="rgba(59,47,47,0.55)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: PAPER, borderWidth: 2, borderColor: INK, borderRadius: 18, width: "100%", maxWidth: 320, maxHeight: "75%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderBottomWidth: 1.5, borderColor: INK }}>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: INK }}>Куда поместить дело?</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ padding: 12 }}>
            {rows.length === 0 && <Text style={{ color: "#a0907e", fontSize: 12.5, fontStyle: "italic" }}>Пока нет ни одной метки. Сначала создай хотя бы одну.</Text>}
            {rows.map((r) => (
              <Pressable
                key={`${r.screenId}-${r.markerId}`}
                onPress={() => onPick(r.screenId, r.markerId)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 1.5, borderColor: INK, borderRadius: 10, padding: 10, marginBottom: 8 }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: r.color, borderWidth: 1.5, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: INK, fontWeight: "bold" }}>{r.markerName}</Text>
                  <Text style={{ fontSize: 10.5, color: "#9a8a76" }}>{r.screenName.replace(/^[^\wА-Яа-я]+/, "")}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

function GuidesListOverlay({ onSelect, onClose }) {
  return (
    <Overlay zIndex={73}>
      <OverlayHeader onBack={onClose} title="🧭 ГИДЫ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {Object.keys(GUIDE_META).map((key) => {
          const meta = GUIDE_META[key];
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: CARD, borderWidth: 1.5, borderColor: INK, borderRadius: 12, padding: 12, marginBottom: 8 }}
            >
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: meta.color, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "bold", color: INK, flex: 1 }}>{meta.name}</Text>
              <Text style={{ fontSize: 16, color: "#9a8a76" }}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Overlay>
  );
}

function GuideTasksOverlay({ guideKey, chainOffer, takenCount, guideRoll, onTakeChain, onCustom, onRollRandom, onTakeRandom, onBack, onClose }) {
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const meta = GUIDE_META[guideKey] || { name: "ГИД", emoji: "🧑", color: "#EEE" };
  const randomUnlocked = (takenCount || 0) >= GUIDE_UNLOCK_RANDOM_AT;
  const rollIsMine = guideRoll && guideRoll.guideKey === guideKey;

  return (
    <Overlay zIndex={74} background={PAPER}>
      <OverlayHeader onBack={onBack} backLabel="Гиды" title={meta.name} onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: meta.color, borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 30 }}>{meta.emoji}</Text>
          </View>
          <Text style={{ fontSize: 11, color: "#8a7a6a", marginTop: 6 }}>Принято заданий: {takenCount || 0}</Text>
        </View>

        {chainOffer ? (
          <View style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 14, padding: 16, marginBottom: 18, backgroundColor: CARD }}>
            <Text style={{ fontSize: 14, color: INK, textAlign: "center", marginBottom: 14, lineHeight: 20 }}>{chainOffer.text}</Text>
            {!showCustom ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <PrimaryButton label="Да" color={GREEN} onPress={() => onTakeChain(chainOffer)} style={{ flex: 1 }} />
                <PrimaryButton label="Нет" color="#fff" textColor={INK} onPress={() => setShowCustom(true)} style={{ flex: 1 }} />
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 12, color: "#8a7a6a", textAlign: "center", marginBottom: 10 }}>А что-то своё хочешь? Напиши — я подумаю.</Text>
                <TextInput
                  value={customText}
                  onChangeText={setCustomText}
                  placeholder="Например: заказать пиццу"
                  placeholderTextColor="#a0907e"
                  style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 10 }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <PrimaryButton label="Ничего" color="#fff" textColor={INK} onPress={() => setShowCustom(false)} style={{ flex: 1 }} />
                  <PrimaryButton label="Добавить" color={GREEN} onPress={() => customText.trim() && onCustom(customText.trim())} style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </View>
        ) : (
          !randomUnlocked && (
            <Text style={{ fontSize: 13, color: "#8a7a6a", textAlign: "center", marginBottom: 18 }}>Сюжетные задания закончились. Бери случайные ниже.</Text>
          )
        )}

        {randomUnlocked ? (
          <View style={{ borderWidth: 1.5, borderColor: INK, borderStyle: "dashed", borderRadius: 14, padding: 16, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: "#8a7a6a", marginBottom: 10 }}>🎲 Рандомайзер открыт</Text>
            {rollIsMine ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: INK, textAlign: "center", marginBottom: 14 }}>{guideRoll.title}</Text>
                <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                  <PrimaryButton label="🎲 Ещё раз" color="#fff" textColor={INK} onPress={() => onRollRandom(guideKey)} style={{ flex: 1 }} />
                  <PrimaryButton label="Взять задачу" color={GREEN} onPress={onTakeRandom} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <PrimaryButton label="🎲 Крутить" color={meta.color} textColor={INK} onPress={() => onRollRandom(guideKey)} style={{ width: "100%" }} />
            )}
          </View>
        ) : (
          <Text style={{ fontSize: 11, color: "#a0907e", textAlign: "center", marginTop: 6 }}>
            Рандомайзер откроется после {GUIDE_UNLOCK_RANDOM_AT} принятых заданий (сейчас {takenCount || 0}).
          </Text>
        )}
      </ScrollView>
    </Overlay>
  );
}

function TitleUnlockDialog({ title, onClose }) {
  if (!title) return null;
  return (
    <Overlay zIndex={78} background="rgba(59,47,47,0.55)">
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: PAPER, borderWidth: 2, borderColor: INK, borderRadius: 18, width: "100%", maxWidth: 280, padding: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#8a7a6a", fontWeight: "bold", marginBottom: 8 }}>🏆 НОВЫЙ ТИТУЛ</Text>
          <Text style={{ fontSize: 34, marginBottom: 4 }}>{title.emoji}</Text>
          <Text style={{ fontSize: 17, fontWeight: "bold", color: INK, marginBottom: 8 }}>{title.name.toUpperCase()}</Text>
          <Text style={{ fontSize: 13, color: "#8a7a6a", textAlign: "center", marginBottom: 16 }}>{title.desc}</Text>
          <PrimaryButton label="Забрать" color={GREEN} onPress={onClose} style={{ width: "100%" }} />
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

function ThemePickerOverlay({ current, onSelect, onClose }) {
  return (
    <Overlay zIndex={80}>
      <OverlayHeader onBack={onClose} title="🎨 ТЕМА" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {Object.keys(THEMES).map((key) => {
          const t = THEMES[key];
          const active = key === current;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: t.card,
                borderWidth: active ? 3 : 1.5,
                borderColor: t.ink,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
              }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.bar, borderWidth: 2, borderColor: t.ink }} />
              <Text style={{ fontSize: 14, fontWeight: "bold", color: t.ink, flex: 1 }}>{t.label}</Text>
              {active && <Text style={{ fontSize: 16, color: t.ink }}>✓</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </Overlay>
  );
}

function TitlesOverlay({ guideProgress, onClose }) {
  return (
    <Overlay zIndex={56}>
      <OverlayHeader onBack={onClose} title="🏆 ТИТУЛЫ" onClose={onClose} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {Object.keys(GUIDE_TITLES).map((guideKey) => {
          const progress = guideProgress[guideKey] || 0;
          const meta = GUIDE_META[guideKey] || { name: guideKey, emoji: "🧑" };
          return (
            <View key={guideKey} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 12, color: "#8a7a6a", marginBottom: 8 }}>
                {meta.emoji} {meta.name} · выполнено дел: {progress}
              </Text>
              {GUIDE_TITLE_TIERS.map((tier) => {
                const t = GUIDE_TITLES[guideKey][tier];
                const unlocked = progress >= tier;
                return (
                  <View
                    key={tier}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      backgroundColor: unlocked ? CARD : "#EFEFEF",
                      borderWidth: 1.5,
                      borderColor: INK,
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8,
                      opacity: unlocked ? 1 : 0.55,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{unlocked ? t.emoji : "🔒"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "bold", color: INK }}>{t.name}</Text>
                      <Text style={{ fontSize: 10.5, color: "#8a7a6a" }}>{unlocked ? t.desc : `За ${tier} дел от гида`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </Overlay>
  );
}

function OthersList({ pool, onClose, onTake, onRefresh }) {
  return (
    <Overlay zIndex={57}>
      <OverlayHeader onBack={onClose} title="🌐 ДРУГИЕ" onClose={onClose} />
		<ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
		  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
			<Text style={{ fontSize: 11.5, color: "#8a7a6a", flex: 1, paddingRight: 8 }}>
			  Задачи, которыми поделились другие (анонимно).
			</Text>
			<Pressable
			  onPress={onRefresh}
			  style={{ borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#fff" }}
			>
			  <Text style={{ fontSize: 12 }}>🔄</Text>
			</Pressable>
		  </View>
        {pool.length === 0 && <Text style={{ color: "#a0907e", fontSize: 13, fontStyle: "italic" }}>Пока никто ничего не расшарил.</Text>}
        {pool.map((p) => (
          <View key={p.title} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 1.5, borderColor: INK, borderRadius: 10, padding: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, color: INK, fontWeight: "bold" }}>{p.title}</Text>
              {p.due ? <Text style={{ fontSize: 10.5, color: "#9a8a76" }}>{formatRemaining(p.due)}</Text> : null}
            </View>
            <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>{p.count}</Text>
            </View>
            <Pressable onPress={() => onTake(p)} style={{ backgroundColor: GREEN, borderWidth: 1.5, borderColor: INK, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "#fff", fontSize: 11.5, fontWeight: "bold" }}>Взять</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Overlay>
  );
}

function dedupeIds(screensObj) {
  const seen = new Set();
  const fix = (oldId, prefix) =>
    seen.has(oldId) ? `${prefix}_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : oldId;

  Object.values(screensObj).forEach((scr) => {
    (scr.markers || []).forEach((mk) => {
      const newMkId = fix(mk.id, "m");
      if (newMkId !== mk.id) mk.id = newMkId;
      seen.add(mk.id);
      (mk.tasks || []).forEach((t) => {
        const newTId = fix(t.id, "t");
        if (newTId !== t.id) t.id = newTId;
        seen.add(t.id);
      });
    });
  });
  return screensObj;
}

export default function App() {
  const [screens, setScreens] = useState(initialScreens);
  const [currentId, setCurrentId] = useState("main");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editAction, setEditAction] = useState("none");
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [showAddScreen, setShowAddScreen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingDeleteField, setPendingDeleteField] = useState(null);
  const [topLevelOrder, setTopLevelOrder] = useState(["main"]);
  const [showJournal, setShowJournal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [journalDetail, setJournalDetail] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [guideProgress, setGuideProgress] = useState({ proper: 0, joper: 0 });
  const [guideUsedOffers, setGuideUsedOffers] = useState([]); // взятые offer.id из цепочки
  const [guideTakenCount, setGuideTakenCount] = useState({ proper: 0, joper: 0 }); // всего принято (цепочка+рандом)
  const [guideUsedRandom, setGuideUsedRandom] = useState({ proper: [], joper: [] }); // взятые названия из рандом-пула
  const [showGuidesList, setShowGuidesList] = useState(false);
  const [activeGuideKey, setActiveGuideKey] = useState(null); // какой гид открыт
  const [guideRoll, setGuideRoll] = useState(null); // { guideKey, title } — текущее выпавшее случайное задание
  const [placementConfirm, setPlacementConfirm] = useState(null);
  const [titleUnlock, setTitleUnlock] = useState(null); // { name, emoji, desc }
  const [showTitles, setShowTitles] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null); // { title, due, notes, source, repeat }
  const [showOthers, setShowOthers] = useState(false);
  const [sharedPool, setSharedPool] = useState([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [themeName, setThemeName] = useState("light");
  const [showThemePicker, setShowThemePicker] = useState(false);
  applyTheme(themeName);

  // Загрузка данных при старте
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("questmap_v1");
        if (raw) {
          const data = JSON.parse(raw);
          if (data.screens) setScreens(dedupeIds(data.screens));
          if (data.topLevelOrder) setTopLevelOrder(data.topLevelOrder);
          if (data.historyLog) setHistoryLog(data.historyLog);
          if (data.guideProgress) setGuideProgress(data.guideProgress);
          if (data.guideUsedOffers) setGuideUsedOffers(data.guideUsedOffers);
          if (data.guideTakenCount) setGuideTakenCount(data.guideTakenCount);
          if (data.guideUsedRandom) setGuideUsedRandom(data.guideUsedRandom);
          if (data.themeName) setThemeName(data.themeName);
        }
      } catch (e) {
        // данных нет или битые — стартуем с initialScreens
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Автосохранение при любом изменении
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(
      "questmap_v1",
      JSON.stringify({ screens, topLevelOrder, historyLog, guideProgress, guideUsedOffers, guideTakenCount, guideUsedRandom, themeName })
    ).catch(() => {});
  }, [screens, topLevelOrder, historyLog, guideProgress, guideUsedOffers, guideTakenCount, guideUsedRandom, themeName, loaded]);

  const screen = screens[currentId];
  const activeMarker = (screen.markers || []).find((m) => m.id === activeTaskId) || null;

  const backStateRef = useRef();
  backStateRef.current = {
    placementConfirm,
    titleUnlock,
    pendingDeleteField,
    pendingDelete,
    pendingPlacement,
    guideRoll,
    activeGuideKey,
    showGuidesList,
    showThemePicker,
    showFieldMenu,
    showTitles,
    journalDetail,
    showJournal,
    showHistory,
    showOthers,
    showAddScreen,
    showAddMarker,
    activeTaskId,
    editMode,
    currentId,
    screen,
  };

  useEffect(() => {
    const onBackPress = () => {
      const s = backStateRef.current;
      if (s.placementConfirm) {
        setPlacementConfirm(null);
        return true;
      }
      if (s.titleUnlock) {
        setTitleUnlock(null);
        return true;
      }
      if (s.pendingDeleteField) {
        setPendingDeleteField(null);
        return true;
      }
      if (s.pendingDelete) {
        setPendingDelete(null);
        return true;
      }
      if (s.pendingPlacement) {
        const { source, guideOfferId, guideRandomTitle } = s.pendingPlacement;
        if (source && guideOfferId) {
          setGuideUsedOffers((prev) => prev.filter((id) => id !== guideOfferId));
          setGuideTakenCount((prev) => ({ ...prev, [source]: Math.max(0, (prev[source] || 0) - 1) }));
        } else if (source && guideRandomTitle) {
          setGuideUsedRandom((prev) => ({ ...prev, [source]: (prev[source] || []).filter((t) => t !== guideRandomTitle) }));
          setGuideTakenCount((prev) => ({ ...prev, [source]: Math.max(0, (prev[source] || 0) - 1) }));
        }
        setPendingPlacement(null);
        return true;
      }
      if (s.guideRoll) {
        setGuideRoll(null);
        return true;
      }
      if (s.activeGuideKey) {
        setActiveGuideKey(null);
        return true;
      }
      if (s.showGuidesList) {
        setShowGuidesList(false);
        return true;
      }
      if (s.showThemePicker) {
        setShowThemePicker(false);
        return true;
      }
      if (s.showFieldMenu) {
        setShowFieldMenu(false);
        return true;
      }
      if (s.showTitles) {
        setShowTitles(false);
        return true;
      }
      if (s.journalDetail) {
        setJournalDetail(null);
        return true;
      }
      if (s.showJournal) {
        setShowJournal(false);
        return true;
      }
      if (s.showHistory) {
        setShowHistory(false);
        return true;
      }
      if (s.showOthers) {
        setShowOthers(false);
        return true;
      }
      if (s.showAddScreen) {
        setShowAddScreen(false);
        return true;
      }
      if (s.showAddMarker) {
        setShowAddMarker(false);
        return true;
      }
      if (s.activeTaskId) {
        setActiveTaskId(null);
        return true;
      }
      if (s.editMode) {
        setEditMode(false);
        return true;
      }
      if (s.currentId !== "main") {
        setCurrentId(s.screen.parentId || "main");
        return true;
      }
      setShowExitConfirm(true);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  const updateScreen = (id, fn) => setScreens((prev) => ({ ...prev, [id]: fn(prev[id]) }));

  const archiveTasks = (scr, mk) => {
    const entries = (mk.tasks || []).map((task) => ({
      screenId: scr.id,
      screenName: scr.name,
      markerId: mk.id,
      markerName: mk.name,
      markerEmoji: mk.emoji,
      markerColor: mk.color,
      task,
      removedAt: Date.now(),
    }));
    if (entries.length) setHistoryLog((prev) => [...prev, ...entries]);
  };
  const archiveScreen = (scr) => (scr.markers || []).forEach((mk) => archiveTasks(scr, mk));

  const handleOpen = (marker) => {
    if (marker.linkTo) {
      setCurrentId(marker.linkTo);
      setEditMode(false);
      return;
    }
    setActiveTaskId(marker.id);
  };

  const handleDragMove = (markerId, x, y) => {
    updateScreen(currentId, (s) => ({ ...s, markers: s.markers.map((m) => (m.id === markerId ? { ...m, x, y } : m)) }));
  };

  const bumpGuideProgress = (guideKey) => {
    setGuideProgress((prev) => {
      const next = { ...prev, [guideKey]: (prev[guideKey] || 0) + 1 };
      const count = next[guideKey];
      const tiers = GUIDE_TITLES[guideKey];
      if (tiers && tiers[count]) {
        setTitleUnlock(tiers[count]);
      }
      return next;
    });
  };

  const toggleTask = (markerId, taskId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    const task = marker && marker.tasks.find((t) => t.id === taskId);
    const shouldAward = !!(task && !task.done && !task.titleAwarded && task.source && GUIDE_TITLES[task.source]);
    if (shouldAward) bumpGuideProgress(task.source);
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) =>
        m.id === markerId
          ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done, titleAwarded: shouldAward ? true : t.titleAwarded } : t)) }
          : m
      ),
    }));
  };

  // Повторяющееся дело: тап по "+" прибавляет 1 к счётчику; когда
  // счётчик доходит до цели — дело считается выполненным (done: true),
  // это по-прежнему одно дело, не несколько.
  const incrementRepeat = (markerId, taskId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    const task = marker && marker.tasks.find((t) => t.id === taskId);
    if (!task || !task.repeat || task.done) return;
    const nextCount = Math.min(task.repeat.target, task.repeat.count + 1);
    const willFinish = nextCount >= task.repeat.target;
    const shouldAward = !!(willFinish && !task.titleAwarded && task.source && GUIDE_TITLES[task.source]);
    if (shouldAward) bumpGuideProgress(task.source);
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) =>
        m.id === markerId
          ? {
              ...m,
              tasks: m.tasks.map((t) =>
                t.id === taskId
                  ? { ...t, repeat: { ...t.repeat, count: nextCount }, done: willFinish, titleAwarded: shouldAward ? true : t.titleAwarded }
                  : t
              ),
            }
          : m
      ),
    }));
  };

  const addTask = (markerId, title, due, repeat) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) =>
        m.id === markerId ? { ...m, tasks: [...(m.tasks || []), { id: nextId(), title, due, done: false, notes: [], createdAt: Date.now(), repeat: repeat || null }] } : m
      ),
    }));
  };
  const addTaskGlobal = (screenId, markerId, title, due, notes, source, repeat) => {
    setScreens((prev) => ({
      ...prev,
      [screenId]: {
        ...prev[screenId],
        markers: prev[screenId].markers.map((m) =>
          m.id === markerId
            ? {
                ...m,
                tasks: [
                  ...(m.tasks || []),
                  {
                    id: nextId(),
                    title,
                    due: due || null,
                    done: false,
                    notes: (notes || []).map((t) => ({ text: t, done: false })),
                    createdAt: Date.now(),
                    source: source || undefined,
                    repeat: repeat || null,
                  },
                ],
              }
            : m
        ),
      },
    }));
  };

  // ---- Гиды: сюжетная цепочка -> рандомайзер после 10 принятых заданий ----
  const openGuide = (guideKey) => {
    setActiveGuideKey(guideKey);
    setGuideRoll(null);
    setShowGuidesList(false);
  };
  const nextChainOfferFor = (guideKey) => {
    const chain = GUIDE_CHAINS[guideKey] || [];
    return chain.find((o) => !guideUsedOffers.includes(o.id)) || null;
  };
  const takeChainOffer = (guideKey, offer) => {
    setGuideUsedOffers((prev) => [...prev, offer.id]);
    setGuideTakenCount((prev) => ({ ...prev, [guideKey]: (prev[guideKey] || 0) + 1 }));
    setPendingPlacement({ title: offer.taskTitle, due: null, notes: offer.starterNotes || [], source: guideKey, repeat: null, guideOfferId: offer.id });
    setActiveGuideKey(null);
  };
  const takeCustomInstead = (guideKey, text) => {
    setPendingPlacement({ title: text, due: null, notes: [], source: undefined, repeat: null });
    setActiveGuideKey(null);
  };
  const rollGuideRandom = (guideKey) => {
    const pool = GUIDE_RANDOM_POOLS[guideKey] || [];
    const used = guideUsedRandom[guideKey] || [];
    let fresh = pool.filter((t) => !used.includes(t));
    if (fresh.length === 0) fresh = pool; // пул исчерпан — начинаем крутить заново
    if (fresh.length === 0) return;
    const title = fresh[Math.floor(Math.random() * fresh.length)];
    setGuideRoll({ guideKey, title });
  };
  const takeGuideRandom = () => {
    if (!guideRoll) return;
    const { guideKey, title } = guideRoll;
    setGuideUsedRandom((prev) => ({ ...prev, [guideKey]: [...(prev[guideKey] || []), title] }));
    setGuideTakenCount((prev) => ({ ...prev, [guideKey]: (prev[guideKey] || 0) + 1 }));
    // Рутинные дела из рандомайзера — повторяющиеся по умолчанию (3-7 раз),
    // чтобы закрепить привычку, а не отметить один раз и забыть.
    const target = 3 + Math.floor(Math.random() * 5);
    setPendingPlacement({ title, due: null, notes: [], source: guideKey, repeat: { count: 0, target }, guideRandomTitle: title });
    setGuideRoll(null);
    setActiveGuideKey(null);
  };

  const placeTask = (screenId, markerId) => {
    if (!pendingPlacement) return;
    addTaskGlobal(screenId, markerId, pendingPlacement.title, pendingPlacement.due, pendingPlacement.notes, pendingPlacement.source, pendingPlacement.repeat);
    const scr = screens[screenId];
    const mk = scr && scr.markers.find((m) => m.id === markerId);
    setPlacementConfirm({ title: pendingPlacement.title, markerName: mk ? mk.name : "" });
    setPendingPlacement(null);
  };

  // Если пользователь закрыл выбор метки, ничего не выбрав — задание не
  // должно "сгорать": возвращаем его гиду (снимаем как взятое).
  const cancelPendingPlacement = () => {
    if (pendingPlacement) {
      const { source, guideOfferId, guideRandomTitle } = pendingPlacement;
      if (source && guideOfferId) {
        setGuideUsedOffers((prev) => prev.filter((id) => id !== guideOfferId));
        setGuideTakenCount((prev) => ({ ...prev, [source]: Math.max(0, (prev[source] || 0) - 1) }));
      } else if (source && guideRandomTitle) {
        setGuideUsedRandom((prev) => ({ ...prev, [source]: (prev[source] || []).filter((t) => t !== guideRandomTitle) }));
        setGuideTakenCount((prev) => ({ ...prev, [source]: Math.max(0, (prev[source] || 0) - 1) }));
      }
    }
    setPendingPlacement(null);
  };

  const loadSharedPool = async () => {
    if (SHARE_API.baseUrl) {
      try {
        const res = await fetch(`${SHARE_API.baseUrl}/pool`);
        const data = await res.json();
        setSharedPool(data);
        return;
      } catch (e) {
        // сервер недоступен — покажем локальный демо-пул ниже
      }
    }
    try {
      const raw = await AsyncStorage.getItem(SHARE_POOL_KEY);
      const items = raw ? JSON.parse(raw) : [];
      const groups = {};
      items.forEach((it) => {
        const key = (it.title || "").trim().toLowerCase();
        if (!key) return;
        if (!groups[key]) groups[key] = { title: it.title, due: it.due, count: 0 };
        groups[key].count += 1;
        groups[key].due = it.due;
      });
      setSharedPool(Object.values(groups));
    } catch (e) {
      setSharedPool([]);
    }
  };

  const shareTaskToPool = async (title, due) => {
    if (SHARE_API.baseUrl) {
      try {
        await fetch(`${SHARE_API.baseUrl}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, due }),
        });
        return;
      } catch (e) {
        // сервер недоступен — сохраним локально ниже
      }
    }
    try {
      const raw = await AsyncStorage.getItem(SHARE_POOL_KEY);
      const items = raw ? JSON.parse(raw) : [];
      items.push({ title, due });
      await AsyncStorage.setItem(SHARE_POOL_KEY, JSON.stringify(items));
    } catch (e) {
      // молча пропускаем — шаринг необязателен
    }
  };

  const deleteTask = (markerId, taskId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    const task = marker && marker.tasks.find((t) => t.id === taskId);
    if (marker && task) {
      setHistoryLog((prev) => [
        ...prev,
        { screenId: currentId, screenName: screen.name, markerId: marker.id, markerName: marker.name, markerEmoji: marker.emoji, markerColor: marker.color, task, removedAt: Date.now() },
      ]);
    }
    updateScreen(currentId, (s) => ({ ...s, markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.filter((t) => t.id !== taskId) } : m)) }));
  };
  const addNoteLocal = (markerId, taskId, text) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...(t.notes || []), { text, done: false }] } : t)) } : m)),
    }));
  };
  const removeNoteLocal = (markerId, taskId, idx) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((_, i) => i !== idx) } : t)) } : m)),
    }));
  };
  const toggleNoteLocal = (markerId, taskId, idx) => {
    updateScreen(currentId, (s) => ({
      ...s,
      markers: s.markers.map((m) =>
        m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.map((n, i) => (i === idx ? { ...n, done: !n.done } : n)) } : t)) } : m
      ),
    }));
  };

  const createMarker = ({ name, emoji, color, type, image, asField }) => {
    if (asField) {
      const newScreenId = `s${nextId()}`;
      const markerId = `m${nextId()}`;
      setScreens((prev) => ({
        ...prev,
        [currentId]: {
          ...prev[currentId],
          markers: [...prev[currentId].markers, { id: markerId, name, emoji, color, type: type || "general", image: image || null, x: 50, y: 50, linkTo: newScreenId }],
        },
        [newScreenId]: { id: newScreenId, name: `${emoji} ${name.toUpperCase()} — ДЕЛА`, theme: "home", parentId: currentId, markers: [] },
      }));
    } else {
      updateScreen(currentId, (s) => ({ ...s, markers: [...s.markers, { id: `m${nextId()}`, name, emoji, color, type: type || "general", image: image || null, x: 50, y: 50, tasks: [] }] }));
    }
    setShowAddMarker(false);
  };

  const createScreen = ({ name, emoji, image }) => {
    const newId = `s${nextId()}`;
    setScreens((prev) => ({ ...prev, [newId]: { id: newId, name: `${emoji} ${name.toUpperCase()}`, theme: "city", image: image || null, parentId: null, markers: [] } }));
    setTopLevelOrder((prev) => [...prev, newId]);
    setShowAddScreen(false);
    setEditMode(false);
    setCurrentId(newId);
  };

  const updateScreenImage = (screenId, uri) => {
    setScreens((prev) => ({ ...prev, [screenId]: { ...prev[screenId], image: uri } }));
  };

  const pickBackgroundImage = async (screenId) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const src = result.assets[0].uri;
      const ext = src.split(".").pop() || "jpg";
      const dst = `${FileSystem.documentDirectory}bg_${Date.now()}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: src, to: dst });
        updateScreenImage(screenId, dst);
      } catch (e) {
        updateScreenImage(screenId, src);
      }
    }
  };

  const deleteField = (id) => {
    const scr = screens[id];
    if (scr) archiveScreen(scr);
    setScreens((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTopLevelOrder((prev) => prev.filter((x) => x !== id));
    if (currentId === id) setCurrentId("main");
  };

  const deleteMarker = (markerId) => {
    const marker = screen.markers.find((m) => m.id === markerId);
    if (marker) archiveTasks(screen, marker);
    if (marker && marker.linkTo && screens[marker.linkTo]) archiveScreen(screens[marker.linkTo]);
    setScreens((prev) => {
      const next = { ...prev, [currentId]: { ...prev[currentId], markers: prev[currentId].markers.filter((m) => m.id !== markerId) } };
      if (marker && marker.linkTo && next[marker.linkTo]) delete next[marker.linkTo];
      return next;
    });
  };

  const siblings = topLevelOrder.includes(currentId) ? { list: topLevelOrder, index: topLevelOrder.indexOf(currentId) } : { list: [], index: -1 };
  const goSibling = (dir) => {
    const target = siblings.list[siblings.index + dir];
    if (target) setCurrentId(target);
  };

  const swipeResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, g) => {
      if (editMode) return false;
      return Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
    },
    onPanResponderRelease: (evt, g) => {
      if (editMode) return;
      if (g.dx < -60) goSibling(1);
      else if (g.dx > 60) goSibling(-1);
    },
  });

  const allEntries = () => {
    const out = [];
    Object.values(screens).forEach((scr) => {
      (scr.markers || []).forEach((mk) => {
        (mk.tasks || []).forEach((task) => {
          out.push({ screenId: scr.id, screenName: scr.name, markerId: mk.id, markerName: mk.name, markerEmoji: mk.emoji, markerColor: mk.color, task });
        });
      });
    });
    return out;
  };
  const activeEntries = allEntries().filter((e) => !e.task.done && !isTaskExpired(e.task));
  const historyEntries = [...allEntries(), ...historyLog].sort((a, b) => (b.task.createdAt || 0) - (a.task.createdAt || 0));

  const hardDeleteEntry = (entry) => {
    if (entry.removedAt) {
      setHistoryLog((prev) => prev.filter((e) => !(e.task.id === entry.task.id && e.removedAt === entry.removedAt)));
    } else {
      setScreens((prev) => {
        const scr = prev[entry.screenId];
        if (!scr) return prev;
        return { ...prev, [entry.screenId]: { ...scr, markers: scr.markers.map((m) => (m.id === entry.markerId ? { ...m, tasks: m.tasks.filter((t) => t.id !== entry.task.id) } : m)) } };
      });
    }
  };

  const findEntry = (loc) => {
    if (!loc) return null;
    const scr = screens[loc.screenId];
    if (!scr) return null;
    const mk = scr.markers.find((m) => m.id === loc.markerId);
    if (!mk) return null;
    const task = (mk.tasks || []).find((t) => t.id === loc.taskId);
    if (!task) return null;
    return { screenId: scr.id, screenName: scr.name, markerId: mk.id, markerName: mk.name, markerEmoji: mk.emoji, markerColor: mk.color, task };
  };
  const journalDetailEntry = findEntry(journalDetail);

  const addNoteGlobal = (text) => {
    if (!journalDetail) return;
    const { screenId, markerId, taskId } = journalDetail;
    setScreens((prev) => ({
      ...prev,
      [screenId]: { ...prev[screenId], markers: prev[screenId].markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: [...(t.notes || []), { text, done: false }] } : t)) } : m)) },
    }));
  };
  const removeNoteGlobal = (idx) => {
    if (!journalDetail) return;
    const { screenId, markerId, taskId } = journalDetail;
    setScreens((prev) => ({
      ...prev,
      [screenId]: { ...prev[screenId], markers: prev[screenId].markers.map((m) => (m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.filter((_, i) => i !== idx) } : t)) } : m)) },
    }));
  };
  const toggleNoteGlobal = (idx) => {
    if (!journalDetail) return;
    const { screenId, markerId, taskId } = journalDetail;
    setScreens((prev) => ({
      ...prev,
      [screenId]: {
        ...prev[screenId],
        markers: prev[screenId].markers.map((m) =>
          m.id === markerId ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, notes: t.notes.map((n, i) => (i === idx ? { ...n, done: !n.done } : n)) } : t)) } : m
        ),
      },
    }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PAPER }} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1.5, borderColor: INK, backgroundColor: BAR_BG }}>
        {screen.parentId ? (
          <Pressable
            onPress={() => {
              setCurrentId(screen.parentId);
              setEditMode(false);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 46 }}
          >
            <Text>← Карта</Text>
          </Pressable>
        ) : (
          <View style={{ width: 46 }} />
        )}
        <Text style={{ fontSize: 16, fontWeight: "bold", color: INK, textAlign: "center", flex: 1 }} numberOfLines={1}>
          {screen.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, minWidth: 100, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setShowThemePicker(true)}>
            <Text style={{ fontSize: 17 }}>🎨</Text>
          </Pressable>
          <Pressable onPress={() => setShowGuidesList((v) => !v)}>
            <Text style={{ fontSize: 17 }}>🧭</Text>
          </Pressable>
          <Pressable onPress={() => setShowTitles(true)}>
            <Text style={{ fontSize: 17 }}>🏆</Text>
          </Pressable>
          <Pressable onPress={() => setShowFieldMenu((v) => !v)}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>⋮</Text>
          </Pressable>
        </View>
      </View>

      {showFieldMenu && (
        <>
          <Pressable
            onPress={() => setShowFieldMenu(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          />
          <View
            style={{
              position: "absolute",
              top: 48,
              right: 14,
              backgroundColor: "#fff",
              borderWidth: 2,
              borderColor: INK,
              borderRadius: 10,
              zIndex: 91,
              overflow: "hidden",
              minWidth: 170,
            }}
          >
            <Pressable
              onPress={() => {
                setShowFieldMenu(false);
                pickBackgroundImage(currentId);
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: INK }}
            >
              <Text style={{ fontSize: 13, color: INK }}>🖼 Изменить фон</Text>
            </Pressable>
            {(currentId === "main" || currentId === "home") && (
              <Pressable
                onPress={() => {
                  setShowFieldMenu(false);
                  updateScreenImage(currentId, currentId === "main" ? MAP_DEFAULT_BG : DOM_DEFAULT_BG);
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: topLevelOrder.includes(currentId) && currentId !== "main" ? 1 : 0, borderColor: INK }}
              >
                <Text style={{ fontSize: 13, color: INK }}>↺ Фон по умолчанию</Text>
              </Pressable>
            )}
            {topLevelOrder.includes(currentId) && currentId !== "main" && (
              <Pressable
                onPress={() => {
                  setShowFieldMenu(false);
                  setPendingDeleteField(screen);
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 14 }}
              >
                <Text style={{ fontSize: 13, color: "#E4572E" }}>🗑 Удалить поле</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      <View
        {...swipeResponder.panHandlers}
        style={{ flex: 1, backgroundColor: THEME_BG[screen.theme || "terrain"] }}
        onLayout={(e) => setMapSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {screen.image && (
          <Image
            source={resolveImageSource(screen.image)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="cover"
          />
        )}
        {screen.markers.map((m) => (
          <Pin
            key={m.id}
            marker={m}
            editMode={editMode}
            editAction={editAction}
            containerSize={mapSize}
            onOpen={handleOpen}
            onDragMove={handleDragMove}
            onDelete={(mk) => setPendingDelete(mk)}
          />
        ))}

        {!editMode && siblings.index > 0 && (
          <Pressable
            onPress={() => goSibling(-1)}
            style={{ position: "absolute", left: 10, top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: GREEN, fontWeight: "bold", fontSize: 18 }}>‹</Text>
          </Pressable>
        )}
        {!editMode && siblings.index !== -1 && siblings.index < siblings.list.length - 1 && (
          <Pressable
            onPress={() => goSibling(1)}
            style={{ position: "absolute", right: 10, top: "50%", marginTop: -17, width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", borderWidth: 2, borderColor: INK, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: GREEN, fontWeight: "bold", fontSize: 18 }}>›</Text>
          </Pressable>
        )}

        {activeMarker && (
          <TaskScreen marker={activeMarker} onClose={() => setActiveTaskId(null)} onToggle={toggleTask} onAdd={addTask} onDelete={deleteTask} onAddNote={addNoteLocal} onRemoveNote={removeNoteLocal} onToggleNote={toggleNoteLocal} onShare={shareTaskToPool} onIncrementRepeat={incrementRepeat} />
        )}
        {showAddMarker && (
          <NewPinForm title="Новая метка" confirmLabel="Добавить метку" showPlaceHints={currentId !== "home"} onClose={() => setShowAddMarker(false)} onCreate={createMarker} />
        )}
        {showAddScreen && <NewPinForm title="Новое поле" confirmLabel="Создать поле" showColor={false} imageAspect={[9, 16]} onClose={() => setShowAddScreen(false)} onCreate={createScreen} />}

        {showJournal && !journalDetail && (
          <JournalList entries={activeEntries} onClose={() => setShowJournal(false)} onOpenDetail={(e) => setJournalDetail({ screenId: e.screenId, markerId: e.markerId, taskId: e.task.id })} />
        )}
        {showJournal && journalDetail && journalDetailEntry && (
          <JournalDetail
            entry={journalDetailEntry}
            onBack={() => setJournalDetail(null)}
            onClose={() => {
              setJournalDetail(null);
              setShowJournal(false);
            }}
            onAddNote={addNoteGlobal}
            onRemoveNote={removeNoteGlobal}
            onToggleNote={toggleNoteGlobal}
          />
        )}
        {showHistory && <HistoryList entries={historyEntries} onClose={() => setShowHistory(false)} onDeleteEntry={hardDeleteEntry} />}
        {showTitles && <TitlesOverlay guideProgress={guideProgress} onClose={() => setShowTitles(false)} />}
        {showThemePicker && (
          <ThemePickerOverlay
            current={themeName}
            onSelect={(key) => {
              setThemeName(key);
              setShowThemePicker(false);
            }}
            onClose={() => setShowThemePicker(false)}
          />
        )}
        {showOthers && (
          <OthersList
            pool={sharedPool}
            onClose={() => setShowOthers(false)}
            onRefresh={loadSharedPool}
            onTake={(p) => {
              setPendingPlacement({ title: p.title, due: p.due || null, notes: [], source: undefined });
              setShowOthers(false);
            }}
          />
        )}
        {showGuidesList && <GuidesListOverlay onSelect={(key) => openGuide(key)} onClose={() => setShowGuidesList(false)} />}
        {activeGuideKey && (
          <GuideTasksOverlay
            guideKey={activeGuideKey}
            chainOffer={nextChainOfferFor(activeGuideKey)}
            takenCount={guideTakenCount[activeGuideKey]}
            guideRoll={guideRoll}
            onTakeChain={(offer) => takeChainOffer(activeGuideKey, offer)}
            onCustom={(text) => takeCustomInstead(activeGuideKey, text)}
            onRollRandom={(key) => rollGuideRandom(key)}
            onTakeRandom={takeGuideRandom}
            onBack={() => {
              setActiveGuideKey(null);
              setGuideRoll(null);
              setShowGuidesList(true);
            }}
            onClose={() => {
              setActiveGuideKey(null);
              setGuideRoll(null);
            }}
          />
        )}
        {titleUnlock && <TitleUnlockDialog title={titleUnlock} onClose={() => setTitleUnlock(null)} />}
        {pendingPlacement && (
          <MarkerPickerModal screens={screens} onClose={cancelPendingPlacement} onPick={(screenId, markerId) => placeTask(screenId, markerId)} />
        )}
        {placementConfirm && (
          <InfoDialog message={`«${placementConfirm.title}» добавлено в «${placementConfirm.markerName}».`} onClose={() => setPlacementConfirm(null)} />
        )}

        {pendingDelete && (
          <ConfirmDialog
            message={`Удалить метку «${pendingDelete.name}»?`}
            onCancel={() => setPendingDelete(null)}
            onConfirm={() => {
              deleteMarker(pendingDelete.id);
              setPendingDelete(null);
            }}
          />
        )}
        {pendingDeleteField && (
          <ConfirmDialog
            message={`Удалить поле «${pendingDeleteField.name}» вместе со всеми метками?`}
            onCancel={() => setPendingDeleteField(null)}
            onConfirm={() => {
              deleteField(pendingDeleteField.id);
              setPendingDeleteField(null);
            }}
          />
        )}
        {showExitConfirm && (
          <ConfirmDialog
            message="Выйти из приложения?"
            confirmLabel="Выйти"
            confirmColor={BLUE}
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={() => {
              setShowExitConfirm(false);
              BackHandler.exitApp();
            }}
          />
        )}
      </View>

      <View
        style={{
          backgroundColor: BAR_BG,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingTop: 10,
          paddingBottom: 12,
          paddingHorizontal: 10,
          shadowColor: INK,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 14,
        }}
      >
        {!editMode ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "space-between" }}>
              {[
                {
                  icon: "📖",
                  label: "Журнал",
                  onPress: () => {
                    setShowHistory(false);
                    setShowOthers(false);
                    setShowJournal(true);
                  },
                },
                {
                  icon: "🕓",
                  label: "История",
                  onPress: () => {
                    setShowJournal(false);
                    setJournalDetail(null);
                    setShowOthers(false);
                    setShowHistory(true);
                  },
                },
                {
                  icon: "🌐",
                  label: "Другие",
                  onPress: () => {
                    setShowJournal(false);
                    setShowHistory(false);
                    setShowOthers(true);
                    loadSharedPool();
                  },
                },
                {
                  icon: "✎",
                  label: "Правка",
                  onPress: () => {
                    setActiveTaskId(null);
                    setShowJournal(false);
                    setJournalDetail(null);
                    setShowHistory(false);
                    setShowOthers(false);
                    setEditMode(true);
                  },
                },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 14, backgroundColor: pressed ? "rgba(59,47,47,0.08)" : "transparent" },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <Text style={{ fontSize: 9.5, fontWeight: "bold", color: INK, marginTop: 2 }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setShowAddMarker(true)}
              style={({ pressed }) => [
                {
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: GREEN,
                  borderWidth: 2,
                  borderColor: INK,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -18,
                  shadowColor: INK,
                  shadowOffset: { width: 2, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 0,
                  elevation: 8,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            >
              <Text style={{ fontSize: 22, color: "#fff", fontWeight: "bold" }}>＋</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
            <Pressable
              onPress={() => setShowAddMarker(true)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1.5, borderColor: INK }}
            >
              <Text style={{ fontSize: 16 }}>＋</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: INK, marginTop: 2 }}>Метка</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowAddScreen(true)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1.5, borderColor: INK }}
            >
              <Text style={{ fontSize: 16 }}>▤</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: INK, marginTop: 2 }}>Поле</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditAction((a) => (a === "delete" ? "none" : "delete"))}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: editAction === "delete" ? INK : "#fff",
                borderWidth: 1.5,
                borderColor: INK,
              }}
            >
              <Text style={{ fontSize: 16 }}>🗑</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: editAction === "delete" ? "#fff" : INK, marginTop: 2 }}>Удалить</Text>
            </Pressable>
            <Pressable onPress={() => setEditMode(false)} style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 14, backgroundColor: GREEN, borderWidth: 1.5, borderColor: INK }}>
              <Text style={{ fontSize: 16 }}>✓</Text>
              <Text style={{ fontSize: 9.5, fontWeight: "bold", color: "#fff", marginTop: 2 }}>Готово</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
