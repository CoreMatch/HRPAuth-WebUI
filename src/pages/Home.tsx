import { Box, Typography, } from "@mui/material";
import logo from "/revolution.png";
import { useMeta } from '../hooks/useMeta';

export default function Home() {
  useMeta('home');
	return (
		<>
			{/* 顶部图片 Banner */}
			<Box
				sx={{
					width: "50%",
					maxWidth: "600px",
					aspectRatio: "16/9",
					marginX: "auto",
					mt: "5%",
					mb: "2%",
					backgroundImage: `url(${logo})`,
					backgroundSize: "contain",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
				}}
			/>

			{/* 页面主内容 */}
			<Box sx={{ px: "2%" }}>
				<Box sx={{ maxWidth: "1200px", mx: "auto" }}>
					<Typography id="home-header" variant="h3" gutterBottom>
						Here`s <span style={{ color: "#1976d2" }}>HRPAuth</span>
					</Typography>

					<Typography variant="body1" paragraph>
						A minecraft authentication service, which is designed for <a href="//mc.samuelchest.com/" target="_blank" rel="noopener noreferrer">RevolutionMC</a>.
					</Typography>
				
				</Box>
			</Box>
		</>
	);
}

