// Stops TS complaining about css imports since they're treated as text
declare module "*.css" {
  const content: string;
  export default content;
}
