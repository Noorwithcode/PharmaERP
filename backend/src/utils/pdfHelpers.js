const COLORS = {
  primary: "#174F7A",
  primaryDark: "#123C5D",
  primaryLight: "#EAF3FA",

  text: "#172B3A",
  muted: "#66798A",

  border: "#CBD8E2",

  background: "#F7FAFC",

  white: "#FFFFFF",

  success: "#15803D",
  successLight: "#ECFDF3",

  danger: "#B42318",
  dangerLight: "#FFF1F2",

  warning: "#B45309",
  warningLight: "#FFF7E6",
};

const PAGE = {
  marginLeft: 34,
  marginRight: 34,
  marginTop: 30,
  marginBottom: 32,
};

const drawHorizontalLine = (
  doc,
  y,
  options = {}
) => {
  const {
    color = COLORS.border,
    width = 0.7,
    x1 = PAGE.marginLeft,
    x2 = doc.page.width - PAGE.marginRight,
  } = options;

  doc
    .save()
    .lineWidth(width)
    .strokeColor(color)
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke()
    .restore();
};

const drawRoundedBox = (
  doc,
  x,
  y,
  width,
  height,
  options = {}
) => {
  const {
    radius = 7,
    fill = COLORS.background,
    stroke = COLORS.border,
    lineWidth = 1,
  } = options;

  doc
    .save()
    .lineWidth(lineWidth)
    .roundedRect(
      x,
      y,
      width,
      height,
      radius
    )
    .fillAndStroke(
      fill,
      stroke
    )
    .restore();
};

const addNewPage = (doc) => {
  doc.addPage({
    margin: 0,
  });
};

module.exports = {
  COLORS,
  PAGE,
  drawHorizontalLine,
  drawRoundedBox,
  addNewPage,
};
