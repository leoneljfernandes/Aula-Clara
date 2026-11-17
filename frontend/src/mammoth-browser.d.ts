// mammoth publica tipos solo para su entrada de Node; el build de navegador es el mismo API.
declare module "mammoth/mammoth.browser" {
  const mammoth: typeof import("mammoth");
  export default mammoth;
}
