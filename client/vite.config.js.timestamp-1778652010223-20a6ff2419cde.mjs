// vite.config.js
import { defineConfig, loadEnv } from "file:///D:/Desktop/Insta-Track/client/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Desktop/Insta-Track/client/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../", "VITE_");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET || "http://127.0.0.1:8001",
          changeOrigin: true,
          secure: false
        }
      }
    },
    define: {
      // No extra env defines needed for now
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJkOlxcXFxEZXNrdG9wXFxcXEluc3RhLVRyYWNrXFxcXGNsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiZDpcXFxcRGVza3RvcFxcXFxJbnN0YS1UcmFja1xcXFxjbGllbnRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2Q6L0Rlc2t0b3AvSW5zdGEtVHJhY2svY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gICAgLy8gTG9hZCAuZW52IGZyb20gcHJvamVjdCByb290IChvbmUgbGV2ZWwgdXApXHJcbiAgICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsICcuLi8nLCAnVklURV8nKVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gICAgICAgIHNlcnZlcjoge1xyXG4gICAgICAgICAgICBwb3J0OiA1MTczLFxyXG4gICAgICAgICAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gICAgICAgICAgICBwcm94eToge1xyXG4gICAgICAgICAgICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBlbnYuVklURV9QUk9YWV9UQVJHRVQgfHwgJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMScsXHJcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGRlZmluZToge1xyXG4gICAgICAgICAgICAvLyBObyBleHRyYSBlbnYgZGVmaW5lcyBuZWVkZWQgZm9yIG5vd1xyXG4gICAgICAgIH0sXHJcbiAgICB9XHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVIsU0FBUyxjQUFjLGVBQWU7QUFDdlQsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXRDLFFBQU0sTUFBTSxRQUFRLE1BQU0sT0FBTyxPQUFPO0FBRXhDLFNBQU87QUFBQSxJQUNILFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxJQUNqQixRQUFRO0FBQUEsTUFDSixNQUFNO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsUUFDSCxRQUFRO0FBQUEsVUFDSixRQUFRLElBQUkscUJBQXFCO0FBQUEsVUFDakMsY0FBYztBQUFBLFVBQ2QsUUFBUTtBQUFBLFFBQ1o7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLElBQ0EsUUFBUTtBQUFBO0FBQUEsSUFFUjtBQUFBLEVBQ0o7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
